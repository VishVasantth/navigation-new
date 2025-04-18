import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, Circle } from 'react-leaflet';
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
import { DEFAULT_CENTER, MAP_BOUNDS, DEFAULT_OBSTACLE_SIZE_METERS, AMRITA_LOCATIONS, PATH_COLORS } from './config/constants';

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
    toggleShowAllPaths
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
        
        {/* Always show the route selector once a path is found */}
        {path && path.length > 0 && (
          <RouteSelector
            routes={routes}
            selectedPathIndex={selectedPathIndex}
            selectPath={selectPath}
            showAllPaths={showAllPaths}
            toggleShowAllPaths={toggleShowAllPaths}
          />
        )}
      </div>
      
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={17} 
        maxZoom={19}
        minZoom={15}
        zoomControl={false}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        attributionControl={true}
        whenCreated={(map) => {
          // Add event listeners to ensure map stays within bounds
          map.on('drag', () => {
            map.panInsideBounds(MAP_BOUNDS, { animate: false });
          });
          
          // Force map to respect zoom limits
          map.on('zoomend', () => {
            if (map.getZoom() > 19) map.setZoom(19);
            if (map.getZoom() < 15) map.setZoom(15);
          });
        }}
        style={{ height: '100vh', width: '100vw' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Add zoom control on the right side */}
        <ZoomControl position="topright" />
        
        {/* Show primary path line */}
        {path && path.length > 0 && (
          <Polyline 
            positions={path} 
            color={PATH_COLORS[selectedPathIndex % PATH_COLORS.length]}
            weight={5} 
            opacity={1.0}
          />
        )}
        
        {/* Connect waypoints with straight lines to form a proper path graph */}
        {/* Removing the dotted blue line as requested
        {waypoints && waypoints.length > 1 && (
          <Polyline
            positions={waypoints.map(wp => [wp.position.lat, wp.position.lng])}
            color="#0000FF"
            weight={4}
            opacity={0.8}
            dashArray="8, 8"
          />
        )}
        */}
        
        {/* Show alternative paths if enabled */}
        {showAllPaths && alternativePaths && alternativePaths.slice(0, 2).map((pathData, index) => (
          index !== selectedPathIndex && (
            <Polyline 
              key={`path-${index}`}
              positions={pathData} 
              color={PATH_COLORS[index % PATH_COLORS.length]}
              weight={3} 
              opacity={0.7}
              dashArray="5, 5"
              eventHandlers={{
                click: () => selectPath(index)
              }}
            />
          )
        ))}
        
        {/* Start and end markers */}
        {startMarker && (
          <Marker 
            position={startMarker.position} 
            icon={createStartIcon(startMarker.label)}
          />
        )}
        
        {endMarker && (
          <Marker 
            position={endMarker.position} 
            icon={createEndIcon(endMarker.label)}
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