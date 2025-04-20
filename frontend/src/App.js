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
import MapInitializer from './components/MapInitializer';

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
      
      // Use a single smooth flyToBounds animation
      map.flyToBounds(bounds, {
        padding: [dynamicPadding, dynamicPadding],
        maxZoom: 18,
        animate: true,
        duration: 1.5,  // Longer duration for smoother effect
        easeLinearity: 0.25  // More natural easing
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
        
        // Set a reasonable zoom level with animation
        map.flyTo(center, 16, { 
          animate: true,
          duration: 1.5
        });
        console.log("Used fallback centering method");
      } catch (fallbackError) {
        console.error("Fallback centering also failed:", fallbackError);
      }
    }
  }, [map, path, alternativePaths, showAllPaths, obstacles, startMarker, endMarker]);
  
  // Effect to handle zooming when a path is found or changed
  useEffect(() => {
    // Only fit the map to the route when the path is initially loaded
    if (path && path.length > 0) {
      // Use a small timeout to ensure all paths are fully rendered before animation
      fitMapToRoute();
    }
  }, [fitMapToRoute, path]);
  
  // No separate effect for selectedPathIndex changes to avoid multiple animations
  
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
    <div className={`app ${placingObstacle ? 'placing-obstacle' : ''}`}>
      <div className="controls">
        <h2>Navigation Controls</h2>
        <div className="controls-content">
          <div className="controls-upper">
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
            
            {path && path.length > 0 && (
              <div className="route-selector-container">
                <button 
                  className={`route-selector-toggle ${showRouteSelector ? 'active' : ''}`}
                  onClick={() => setShowRouteSelector(!showRouteSelector)}
                >
                  {showRouteSelector ? 'Hide Route Options' : 'Show Route Options'} 
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
          
          <div className="video-feed-container">
            <DetectionDisplay 
              videoRef={videoRef}
              detectionRunning={detectionRunning}
              objects={objects}
              obstacles={obstacles}
              clearObstacles={clearObstacles}
            />
          </div>
        </div>
      </div>
      
      <div className="map-container">
        <MapContainer 
          center={DEFAULT_CENTER} 
          zoom={16}  
          maxZoom={18}
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          attributionControl={true}
          preferCanvas={true}
          zoomAnimation={true}
          fadeAnimation={true}
          markerZoomAnimation={true}
          inertia={true}
          inertiaDeceleration={3000}
          easeLinearity={0.2}
          worldCopyJump={false}
          maxBoundsViscosity={1.0}
          style={{ 
            height: '100%', 
            width: '100%'
          }}
          whenCreated={(mapInstance) => {
            // Make map instance available in the global scope for debugging if needed
            window.mapInstance = mapInstance;
            // Pre-render the tiles for smoother zoom experiences
            mapInstance.invalidateSize();
            
            // Apply performance optimizations
            mapInstance.options.zoomSnap = 0.5;
            mapInstance.options.zoomDelta = 0.5;
            mapInstance.options.wheelPxPerZoomLevel = 120;
            
            // Add hardware acceleration
            const container = mapInstance.getContainer();
            container.style.transform = 'translate3d(0px, 0px, 0px)';
            container.style.willChange = 'transform';
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Add zoom control on the right side */}
          <ZoomControl position="topright" />
          
          {/* Map initializer to ensure map is properly centered */}
          <MapInitializer center={DEFAULT_CENTER} zoom={16} />
          
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
                  smoothFactor={0.5}
                  renderer={L.canvas({ padding: 0.5 })}
                  interactive={false}
                />
                {/* Inner colored path */}
                <Polyline 
                  positions={pathData} 
                  color="#999999"  /* Gray color for deselected paths */
                  weight={6} 
                  opacity={0.8}
                  zIndex={10}
                  smoothFactor={0.5}
                  renderer={L.canvas({ padding: 0.5 })}
                  interactive={true}
                  bubblingMouseEvents={false}
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
                smoothFactor={0.5}
                renderer={L.canvas({ padding: 0.5 })}
                interactive={false}
              />
              {/* Inner colored path */}
              <Polyline 
                positions={path} 
                color="#0078FF"
                weight={8} 
                opacity={1.0}
                zIndex={55}
                smoothFactor={0.5}
                renderer={L.canvas({ padding: 0.5 })}
                interactive={true}
                bubblingMouseEvents={false}
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
              smoothFactor={0.5}
              renderer={L.canvas({ padding: 0.5 })}
              interactive={false}
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
              smoothFactor={0.5}
              renderer={L.canvas({ padding: 0.5 })}
              interactive={false}
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
              color="#4CAFFF"
              fillColor="#4CAFFF"
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
      </div>
    </div>
  );
}

export default App; 