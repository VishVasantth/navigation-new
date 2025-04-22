import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, Circle, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import './App.css';
import 'leaflet/dist/leaflet.css';

// Components
import MapUpdater from './components/MapUpdater';
import ObstacleMarker from './components/ObstacleMarker';
import LocationControls from './components/LocationControls';
import ControlButtons from './components/ControlButtons';
import DetectionDisplay from './components/DetectionDisplay';
import RouteSelector from './components/RouteSelector';
import NavigationCard from './components/NavigationCard';

// Hooks
import usePath from './hooks/usePath';
import useSimulation from './hooks/useSimulation';
import useDetection from './hooks/useDetection';

// Utils
import { createStartIcon, createEndIcon, createWaypointIcon } from './utils/mapUtils';
import { DEFAULT_CENTER, DEFAULT_OBSTACLE_SIZE_METERS, AMRITA_LOCATIONS, PATH_COLORS } from './config/constants';
import { findClosestPointOnPathWithIndex } from './utils/pathUtils';
import { initWebSocket, isWebSocketConnected } from './services/websocketService';

// Helper function to format distance display
const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(2)} km`;
  }
};

// Helper function to format time display
const formatTime = (minutes) => {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} sec`;
  } else if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} hr ${mins} min`;
  }
};

// Helper component to control the map programmatically
function MapController({ path, alternativePaths, showAllPaths, selectedPathIndex, startMarker, endMarker, obstacles }) {
  const map = useMap();
  
  // Function to fit the map to the current route and markers
  const fitMapToRoute = useCallback(() => {
    if (!path || path.length === 0 || !startMarker || !endMarker) return;
    
    try {
      // Initialize bounds with the main path
      const latLngs = path.map(point => [point[0], point[1]]);
      let bounds = L.latLngBounds(latLngs);
      
      // Include alternative paths in the bounds if they're visible
      if (showAllPaths && alternativePaths && alternativePaths.length > 0) {
        alternativePaths.forEach(altPath => {
          if (altPath && altPath.length > 0) {
            const altLatLngs = altPath.map(point => [point[0], point[1]]);
            altLatLngs.forEach(point => bounds.extend(point));
          }
        });
      }
      
      // Add start and end markers to bounds
      bounds.extend([startMarker.position.lat, startMarker.position.lng]);
      bounds.extend([endMarker.position.lat, endMarker.position.lng]);
      
      // Include obstacles in the bounds if they're close to the path
      if (obstacles && obstacles.length > 0) {
        obstacles.forEach(obstacle => {
          // Only include obstacles that are near the path (within ~50m of bounds)
          if (obstacle.position && 
              Math.abs(obstacle.position[0] - bounds.getCenter().lat) < 0.0005 && 
              Math.abs(obstacle.position[1] - bounds.getCenter().lng) < 0.0005) {
            bounds.extend(obstacle.position);
          }
        });
      }
      
      // Calculate padding based on the size of the bounds
      // Larger area = more padding for context
      const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
      const dynamicPadding = Math.min(100, Math.max(50, boundsSize / 20));
      
      // Add some padding around the bounds for better context
      map.fitBounds(bounds, {
        padding: [dynamicPadding, dynamicPadding],
        maxZoom: 18,
        animate: true,
        duration: 0.7,
        easeLinearity: 0.25
      });
      
      console.log("Map zoomed to fit route and markers");
    } catch (error) {
      console.error("Error while fitting bounds:", error);
      
      // Fallback to a simpler approach if there's an error
      try {
        // Center on the midpoint between start and end markers
        const center = L.latLng(
          (startMarker.position.lat + endMarker.position.lat) / 2,
          (startMarker.position.lng + endMarker.position.lng) / 2
        );
        
        // Set a reasonable zoom level
        map.setView(center, 16, { animate: true });
        console.log("Used fallback centering method");
      } catch (fallbackError) {
        console.error("Fallback centering also failed:", fallbackError);
      }
    }
  }, [map, path, alternativePaths, showAllPaths, obstacles, startMarker, endMarker]);
  
  // Effect to handle zooming when a path is found or changed
  useEffect(() => {
    fitMapToRoute();
  }, [fitMapToRoute, path, selectedPathIndex]);
  
  // Effect to handle route selection changes
  useEffect(() => {
    // When the selected path index changes, we need to refit the map
    if (path && path.length > 0) {
      fitMapToRoute();
    }
  }, [fitMapToRoute, selectedPathIndex]);
  
  return null;
}

function App() {
  // State for location selection
  const [startLocation, setStartLocation] = useState('A1 Staff Quarters');
  const [endLocation, setEndLocation] = useState('AB4 - Amrita School of AI');
  
  // Find the corresponding location objects from the AMRITA_LOCATIONS array
  const startLocationObj = AMRITA_LOCATIONS.find(loc => loc.name === startLocation) || AMRITA_LOCATIONS[0];
  const endLocationObj = AMRITA_LOCATIONS.find(loc => loc.name === endLocation) || AMRITA_LOCATIONS[6];
  
  // State for coordinates - initialized based on selected locations
  const [startLat, setStartLat] = useState(startLocationObj.lat.toString());
  const [startLon, setStartLon] = useState(startLocationObj.lon.toString());
  const [endLat, setEndLat] = useState(endLocationObj.lat.toString());
  const [endLon, setEndLon] = useState(endLocationObj.lon.toString());
  
  // State for obstacles and obstacle placement
  const [obstacles, setObstacles] = useState([]);
  const [placingObstacle, setPlacingObstacle] = useState(false);
  
  // State for route selector visibility
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  
  // State for closest points to markers (for dotted lines)
  const [startRoadConnection, setStartRoadConnection] = useState(null);
  const [endRoadConnection, setEndRoadConnection] = useState(null);
  
  // Use custom hooks
  const { 
    path,
    alternativePaths,
    showAllPaths,
    selectedPathIndex,
    startMarker, 
    endMarker,
    waypoints,
    routes,
    findPath,
    updateClosestPoints,
    selectPath,
    toggleShowAllPaths,
    startPathPoint,
    endPathPoint,
    updatePathFromObstacle
  } = usePath(obstacles);
  
  const { detectionRunning, objects, videoRef, startDetection, stopDetection } = useDetection(setObstacles);
  
  // Handle obstacle detection during simulation
  const handleObstacleDetected = useCallback(async (obstacleLocation) => {
    console.log("Obstacle detected at:", obstacleLocation);
    
    // Check for and remove any existing manually placed obstacles at this location
    setObstacles(prev => {
      // Filter out any manually placed obstacles that are close to this location
      // (within approximately 10 meters)
      const threshold = 0.0001; // ~10 meters in lat/lng
      
      // Keep only obstacles that are either:
      // 1. Not close to the detected location, or
      // 2. Already detected obstacles (to avoid removing other detected obstacle waypoints)
      const filteredObstacles = prev.filter(obs => {
        if (obs.isDetected) return true; // Keep all previously detected obstacles
        
        // Calculate distance to check if this is a manually placed obstacle at the same location
        const latDiff = Math.abs(obs.position[0] - obstacleLocation[0]);
        const lngDiff = Math.abs(obs.position[1] - obstacleLocation[1]);
        
        // If the obstacle is far enough away, keep it
        return (latDiff > threshold || lngDiff > threshold);
      });
      
      // Add a permanent obstacle marker with waypoint styling
      const newObstacle = {
        id: Date.now(),
        position: obstacleLocation,
        radius: 5,
        isDetected: true, // Mark that this was detected during simulation
        isPermanent: true // Mark this as a permanent obstacle
      };
      
      // Return the updated obstacles array with manually placed ones removed
      // and the new permanent marker added
      return [...filteredObstacles, newObstacle];
    });
    
    // Wait a short moment for the obstacle state to update
    setTimeout(() => {
      // Re-route from the obstacle to the destination
      console.log("Attempting to reroute from obstacle to destination");
      
      // Find the best alternative path to use for rerouting
      if (alternativePaths && alternativePaths.length > 1) {
        // Get alternative path (choose a different one than the currently selected)
        const bestAlternativeIndex = (selectedPathIndex === 0) ? 1 : 0;
        const newPath = alternativePaths[bestAlternativeIndex];
        
        // Find the nearest segment on the alternative path to the obstacle location
        const closestPointInfo = findClosestPointOnPathWithIndex(
          obstacleLocation,
          newPath
        );
        
        if (closestPointInfo && closestPointInfo.segmentIndex >= 0) {
          // Use the updatePathFromObstacle function to create a new route
          // from the obstacle location to the destination using the alternative path
          updatePathFromObstacle(
            obstacleLocation, 
            newPath, 
            closestPointInfo.segmentIndex
          );
          
          // Select this path to make it visible
          selectPath(bestAlternativeIndex);
          console.log(`Rerouted using alternative path ${bestAlternativeIndex}`);
        } else {
          console.error("Could not find closest point on alternative path");
        }
      } else {
        console.log("No alternative paths available for rerouting");
      }
    }, 500); // Slightly longer delay to ensure obstacles state is updated
    
    // Don't automatically resume simulation - just find a new route
    // The user can manually resume the simulation if desired
    
  }, [setObstacles, updatePathFromObstacle, alternativePaths, selectedPathIndex, selectPath, findClosestPointOnPathWithIndex]);
  
  // Reference for resuming simulation
  const simulationResumeRef = useRef(null);
  
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [esp32Address, setEsp32Address] = useState('ws://192.168.4.1:81');
  
  const { 
    simulationActive,
    currentLocation,
    movementTrail,
    cleanupAllOperations,
    simulateMovement,
    obstacleDetected,
    obstacleLocation,
    resumeSimulation,
    currentInstruction,
    instructionHistory,
    usingESP32,
    toggleESP32Mode
  } = useSimulation(path, obstacles, handleObstacleDetected);
  
  // Store the resume function in the ref so it can be accessed from the callback
  useEffect(() => {
    simulationResumeRef.current = resumeSimulation;
  }, [resumeSimulation]);
  
  // Function to clear all obstacles
  const clearObstacles = () => {
    setObstacles([]);
  };
  
  // Update road connections for the dotted lines when markers or path change
  useEffect(() => {
    if (path && path.length > 0 && startMarker && endMarker) {
      // For start marker
      const startPoint = [startMarker.position.lat, startMarker.position.lng];
      const startClosestInfo = findClosestPointOnPathWithIndex(startPoint, path);
      if (startClosestInfo && startClosestInfo.point) {
        setStartRoadConnection(startClosestInfo.point);
      }
      
      // For end marker
      const endPoint = [endMarker.position.lat, endMarker.position.lng];
      const endClosestInfo = findClosestPointOnPathWithIndex(endPoint, path);
      if (endClosestInfo && endClosestInfo.point) {
        setEndRoadConnection(endClosestInfo.point);
      }
    } else {
      setStartRoadConnection(null);
      setEndRoadConnection(null);
    }
  }, [path, startMarker, endMarker]);
  
  // Update closest points whenever path or markers change
  useEffect(() => {
    updateClosestPoints();
  }, [path, startMarker, endMarker, updateClosestPoints]);
  
  // Add event listener for obstacle added
  useEffect(() => {
    // Function to handle obstacle added event
    const handleObstacleAdded = (event) => {
      const newObstacle = event.detail.obstacle;
      console.log("Obstacle added event received:", newObstacle);
      
      // Additional logic for handling new obstacles could be added here
    };
    
    // Add event listener
    window.addEventListener('obstacleadded', handleObstacleAdded);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('obstacleadded', handleObstacleAdded);
    };
  }, []);
  
  // Debug logging for paths
  useEffect(() => {
    console.log("Current path:", path);
    console.log("Alternative paths:", alternativePaths);
  }, [path, alternativePaths]);
  
  // Initialize WebSocket connection to ESP32
  const connectToESP32 = useCallback(() => {
    if (isWebSocketConnected()) {
      console.log("Already connected to ESP32");
      return true;
    }
    
    const success = initWebSocket(esp32Address);
    setEsp32Connected(success);
    return success;
  }, [esp32Address]);
  
  // Toggle ESP32 control
  const toggleESP32Control = useCallback(() => {
    if (!esp32Connected) {
      const connected = connectToESP32();
      if (connected) {
        toggleESP32Mode();
      }
    } else {
      toggleESP32Mode();
    }
  }, [esp32Connected, connectToESP32, toggleESP32Mode]);
  
  return (
    <div className={`app ${placingObstacle ? 'placing-obstacle' : ''}`}>
      <div className="controls">
        <h2>Navigation Controls</h2>
        
        <LocationControls
          startLocation={startLocation}
          setStartLocation={setStartLocation}
          endLocation={endLocation}
          setEndLocation={setEndLocation}
          startLat={startLat}
          setStartLat={setStartLat}
          startLon={startLon}
          setStartLon={setStartLon}
          endLat={endLat}
          setEndLat={setEndLat}
          endLon={endLon}
          setEndLon={setEndLon}
        />
        
        <ControlButtons
          cleanupAllOperations={cleanupAllOperations}
          findPath={findPath}
          startLat={startLat}
          startLon={startLon}
          startLocation={startLocation}
          endLat={endLat}
          endLon={endLon}
          endLocation={endLocation}
          simulateMovement={simulateMovement}
          detectionRunning={detectionRunning}
          startDetection={startDetection}
          stopDetection={stopDetection}
          placingObstacle={placingObstacle}
          setPlacingObstacle={setPlacingObstacle}
          clearObstacles={clearObstacles}
        />
        
        {/* ESP32 Control Button */}
        <div className="esp32-control-container">
          <button 
            className={`full-width-button ${usingESP32 ? 'active' : ''}`}
            onClick={toggleESP32Control}
          >
            {usingESP32 ? 'Disable ESP32 Control' : 'Enable ESP32 Control'}
          </button>
          
          {usingESP32 && (
            <div className="esp32-status">
              <span className={`status-indicator ${esp32Connected ? 'connected' : 'disconnected'}`}></span>
              {esp32Connected ? 'ESP32 Connected' : 'ESP32 Disconnected'}
              <input 
                type="text" 
                value={esp32Address} 
                onChange={(e) => setEsp32Address(e.target.value)}
                placeholder="WebSocket address (ws://192.168.4.1:81)" 
                className="esp32-address-input"
              />
              <button 
                className="connect-button"
                onClick={connectToESP32}
              >
                Connect
              </button>
            </div>
          )}
        </div>
        
        {/* Route selector button and collapsible panel */}
        {path && path.length > 0 && (
          <div className="route-selector-container">
            <button 
              className={`route-selector-toggle ${showRouteSelector ? 'active' : ''}`}
              onClick={() => setShowRouteSelector(!showRouteSelector)}
            >
              {showRouteSelector ? 'Hide Route Options' : 'Show Route Options'} 
              {/* {routes.length > 1 && !showRouteSelector && <span className="routes-available-badge">{Math.min(routes.length, 2)}</span>} */}
            </button>
            
            {showRouteSelector && (
              <RouteSelector
                routes={routes}
                selectedPathIndex={selectedPathIndex}
                selectPath={selectPath}
                showAllPaths={showAllPaths}
                toggleShowAllPaths={toggleShowAllPaths}
              />
            )}
          </div>
        )}
      </div>
      
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={16}  // Adjusted initial zoom level
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        attributionControl={true}
        style={{ height: '100vh', width: '100vw' }}
        whenCreated={(mapInstance) => {
          // Make map instance available in the global scope for debugging if needed
          window.mapInstance = mapInstance;
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Add zoom control on the right side */}
        <ZoomControl position="topright" />
        
        {/* Map controller to handle zoom on path change */}
        <MapController 
          path={path} 
          alternativePaths={alternativePaths}
          showAllPaths={showAllPaths}
          selectedPathIndex={selectedPathIndex}
          startMarker={startMarker} 
          endMarker={endMarker} 
          obstacles={obstacles}
        />
        
        {/* First render all non-selected paths with lower z-index */}
        {showAllPaths && alternativePaths && alternativePaths.map((pathData, index) => (
          index !== selectedPathIndex && pathData && pathData.length > 0 && (
            <React.Fragment key={`alt-path-${index}`}>
              {/* White outer stroke for border effect */}
              <Polyline 
                positions={pathData} 
                color="white"
                weight={8} 
                opacity={0.7}
                zIndex={5}
                smoothFactor={1}
                renderer={L.canvas({ padding: 0.5 })}
              />
              {/* Inner colored path */}
              <Polyline 
                positions={pathData} 
                color="#999999"
                weight={6} 
                opacity={0.8}
                zIndex={10}
                smoothFactor={1}
                renderer={L.canvas({ padding: 0.5 })}
                eventHandlers={{
                  click: () => selectPath(index)
                }}
              >
                {routes[index] && (
                  <Tooltip sticky className="route-tooltip">
                    <div>
                      <strong>{index === 0 ? "Fastest Route" : "Alternative Route"}</strong>
                      <div>Distance: {formatDistance(routes[index].distance)}</div>
                      <div>Time: {formatTime(routes[index].time)}</div>
                      {/* <div className="tooltip-hint">Click to select this route</div> */}
                    </div>
                  </Tooltip>
                )}
              </Polyline>
            </React.Fragment>
          )
        ))}
        
        {/* Always render the selected path last so it's on top */}
        {path && path.length > 0 && (
          <React.Fragment key={`selected-path-${selectedPathIndex}`}>
            {/* White outer stroke for border effect */}
            <Polyline 
              positions={path} 
              color="white"
              weight={12}
              opacity={0.9}
              zIndex={50}
              smoothFactor={1}
              renderer={L.canvas({ padding: 0.5 })}
            />
            {/* Inner colored path */}
            <Polyline 
              positions={path} 
              color="#0078FF"
              weight={8} 
              opacity={1.0}
              zIndex={55}
              smoothFactor={1}
              renderer={L.canvas({ padding: 0.5 })}
            >
              {routes[selectedPathIndex] && (
                <Tooltip sticky className="route-tooltip">
                  <div>
                    <strong>Selected Route</strong>
                    <div>Distance: {formatDistance(routes[selectedPathIndex].distance)}</div>
                    <div>Time: {formatTime(routes[selectedPathIndex].time)}</div>
                  </div>
                </Tooltip>
              )}
            </Polyline>
          </React.Fragment>
        )}
        
        {/* Dotted lines from marker to nearest road point */}
        {startMarker && startRoadConnection && (
          <Polyline
            positions={[
              [startMarker.position.lat, startMarker.position.lng],
              startRoadConnection
            ]}
            color="#0078D7"
            weight={3}
            opacity={0.7}
            dashArray="5, 8"
            zIndex={25}
          />
        )}
        
        {endMarker && endRoadConnection && (
          <Polyline
            positions={[
              [endMarker.position.lat, endMarker.position.lng],
              endRoadConnection
            ]}
            color="#0078D7"
            weight={3}
            opacity={0.7}
            dashArray="5, 8"
            zIndex={25}
          />
        )}
        
        {/* Start and end markers */}
        {startMarker && (
          <Marker 
            position={startMarker.position} 
            icon={createStartIcon(startMarker.label)}
            zIndex={30}
          />
        )}
        
        {endMarker && (
          <Marker 
            position={endMarker.position} 
            icon={createEndIcon(endMarker.label)}
            zIndex={30}
          />
        )}
        
        {/* Waypoints - filter out start and end nodes */}
        {/* Hiding all waypoint markers as requested
        {waypoints && waypoints
          .filter(waypoint => waypoint.label !== 'S' && waypoint.label !== 'E')
          .map((waypoint, index) => (
            <Marker 
              key={`waypoint-${index}`}
              position={waypoint.position}
              icon={createWaypointIcon(
                waypoint.label, 
                { 
                  isIntersection: waypoint.isIntersection,
                  isNode: waypoint.isNode
                }
              )}
            />
          ))}
        */}
        
        {/* Obstacles */}
        {obstacles.map((obstacle, index) => (
          <ObstacleMarker 
            key={`obstacle-${index}`}
            obstacle={obstacle}
            setObstacles={setObstacles}
          />
        ))}
        
        {/* Current location during simulation */}
        {simulationActive && currentLocation && currentLocation.length === 2 && (
          <Circle 
            center={currentLocation} 
            radius={5}
            color="#7ECFFF"
            fillColor="#7ECFFF"
            fillOpacity={0.8}
            weight={2}
          />
        )}
        
        {/* Map click handler */}
        <MapUpdater 
          path={path}
          placingObstacle={placingObstacle}
          setObstacles={setObstacles}
          obstacleSize={DEFAULT_OBSTACLE_SIZE_METERS}
        />
      </MapContainer>
      
      {/* Video display for object detection */}
      <DetectionDisplay 
        videoRef={videoRef}
        detectionRunning={detectionRunning}
        objects={objects}
        obstacles={obstacles}
        clearObstacles={clearObstacles}
      />
      
      {/* Navigation Cards Container */}
      {simulationActive && (
        <div className="navigation-cards-container">
          {/* Current instruction card */}
          {currentInstruction && (
            <NavigationCard instruction={currentInstruction} />
          )}
        </div>
      )}
    </div>
  );
}

export default App; 