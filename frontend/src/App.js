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

// Hooks
import usePath from './hooks/usePath';
import useSimulation from './hooks/useSimulation';
import useDetection from './hooks/useDetection';

// Utils
import { createStartIcon, createEndIcon, createWaypointIcon } from './utils/mapUtils';
import { DEFAULT_CENTER, DEFAULT_OBSTACLE_SIZE_METERS, AMRITA_LOCATIONS, PATH_COLORS } from './config/constants';
import { findClosestPointOnPathWithIndex } from './utils/pathUtils';

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
        duration: 0.8
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
    endPathPoint
  } = usePath(obstacles);
  
  const { detectionRunning, objects, videoRef, startDetection, stopDetection } = useDetection(setObstacles);
  
  const { 
    simulationActive,
    currentLocation,
    movementTrail,
    cleanupAllOperations,
    simulateMovement
  } = useSimulation(path, obstacles);
  
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
  
  return (
    <div className="app">
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
        {showAllPaths && alternativePaths && alternativePaths.slice(0, 2).map((pathData, index) => (
          index !== selectedPathIndex && pathData && pathData.length > 0 && (
            <React.Fragment key={`alt-path-${index}`}>
              {/* White outer stroke for border effect */}
              <Polyline 
                positions={pathData} 
                color="white"
                weight={8} 
                opacity={0.7}
                zIndex={5}
              />
              {/* Inner colored path */}
              <Polyline 
                positions={pathData} 
                color="#999999"  /* Gray color for deselected paths */
                weight={6} 
                opacity={0.8}
                zIndex={10}  /* Lower zIndex to place behind selected path */
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
              weight={12}  /* Increased from 10 to 12 */
              opacity={0.9}
              zIndex={50}  /* Increased to ensure it's always above alternatives */
            />
            {/* Inner colored path */}
            <Polyline 
              positions={path} 
              color="#0078FF"  /* Blue color for selected path */
              weight={8} 
              opacity={1.0}
              zIndex={55}  /* Increased to ensure it's always above alternatives */
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
            color="#D83B01"
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
            radius={1.5}
            color="#FF4400"
            fillColor="#FF4400"
            fillOpacity={1}
            weight={2}
          />
        )}
        
        {/* Movement trail */}
        {movementTrail && movementTrail.length > 0 && (
          <Polyline 
            positions={movementTrail}
            color="#FF4400"
            weight={3}
            opacity={0.7}
          />
        )}
        
        {/* Map click handler */}
        <MapUpdater 
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
    </div>
  );
}

export default App; 