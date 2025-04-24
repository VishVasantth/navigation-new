import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, Circle, useMap, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes, faLocationArrow } from '@fortawesome/free-solid-svg-icons';

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
import { generateNavigationInstruction } from './services/navigationService';
import { speakInstruction, isSpeechAvailable } from './services/speechService';

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

// Helper function to calculate distance between two points (in meters)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Helper component to control the map programmatically
function MapController({ 
  path, 
  alternativePaths, 
  showAllPaths, 
  selectedPathIndex, 
  startMarker, 
  endMarker, 
  obstacles,
  userLocation,
  followUser
}) {
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
      
      // Include user's current location if available
      if (userLocation && userLocation.length === 2) {
        bounds.extend(userLocation);
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
  }, [map, path, alternativePaths, showAllPaths, obstacles, startMarker, endMarker, userLocation]);
  
  // Effect to handle zooming when a path is found or changed
  useEffect(() => {
    if (!followUser) {
      fitMapToRoute();
    }
  }, [fitMapToRoute, path, selectedPathIndex, followUser]);
  
  // Effect to handle route selection changes
  useEffect(() => {
    // When the selected path index changes, we need to refit the map
    if (path && path.length > 0 && !followUser) {
      fitMapToRoute();
    }
  }, [fitMapToRoute, selectedPathIndex, path, followUser]);
  
  // Effect to follow user's location
  useEffect(() => {
    if (followUser && userLocation && userLocation.length === 2) {
      map.setView(userLocation, 18, { animate: true });
    }
  }, [map, userLocation, followUser]);
  
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
  
  // State for real-time user tracking
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(null);
  const [followUser, setFollowUser] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [useRealLocation, setUseRealLocation] = useState(false);
  const [prevLocation, setPrevLocation] = useState(null);
  const movementThreshold = 5; // meters
  
  // State for obstacle handling
  const [obstacleHandled, setObstacleHandled] = useState(false);
  
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
    
    // Keep detection running (do not stop)
    
  }, [setObstacles, updatePathFromObstacle, alternativePaths, selectedPathIndex, selectPath]);
  
  // Reference for resuming simulation
  const simulationResumeRef = useRef(null);
  
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
    instructionHistory
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
  
  // Function to start real-time GPS tracking
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    // Request high accuracy location updates
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        setUserLocation([latitude, longitude]);
        if (heading) setUserHeading(heading);
        console.log("Current GPS position:", latitude, longitude);
      },
      (error) => {
        console.error("Error getting location:", error);
        if (error.code === error.PERMISSION_DENIED) {
          alert("Location permission denied. Please enable location services.");
        }
      },
      { 
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000 
      }
    );
    
    setWatchId(id);
    setUseRealLocation(true);
    setFollowUser(true);
    setObstacleHandled(false);
    if (!detectionRunning) {
      startDetection();
    }
    return id;
  }, [detectionRunning, startDetection]);
  
  // Function to stop GPS tracking
  const stopGPSTracking = useCallback(() => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setUseRealLocation(false);
    setFollowUser(false);
    if (detectionRunning) stopDetection();
  }, [watchId, detectionRunning, stopDetection]);
  
  // Function to toggle follow user mode
  const toggleFollowUser = useCallback(() => {
    setFollowUser(prev => !prev);
  }, []);
  
  // Clean up GPS tracking when component unmounts
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);
  
  // State for mobile controls visibility
  const [mobileControlsVisible, setMobileControlsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Function to toggle mobile controls visibility
  const toggleMobileControls = () => {
    setMobileControlsVisible(!mobileControlsVisible);
  };
  
  // Effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      
      // If window gets larger than mobile breakpoint, ensure controls are visible
      if (window.innerWidth > 768) {
        setMobileControlsVisible(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Effect: start/stop object detection based on user movement
  useEffect(() => {
    if (!prevLocation || !userLocation) {
      setPrevLocation(userLocation);
      return;
    }
    const moved = calculateDistance(
      prevLocation[0], prevLocation[1],
      userLocation[0], userLocation[1]
    );
    if (moved > movementThreshold) {
      if (!detectionRunning) startDetection();
    } else {
      if (detectionRunning) stopDetection();
    }
    setPrevLocation(userLocation);
  }, [userLocation]);
  
  // Simplify obstacle effect to run once per detection cycle
  useEffect(() => {
    if (!detectionRunning || !userLocation || obstacleHandled) return;
    // if any obstacle detected, place single marker at GPS and reroute
    if (objects.some(obj => obj.is_obstacle)) {
      const marker = {
        id: 'gps-' + Date.now(),
        position: userLocation,
        radius: DEFAULT_OBSTACLE_SIZE_METERS,
        isDetected: true,
        source: 'gps-detection'
      };
      // replace obstacles with this marker
      setObstacles([marker]);
      // reroute from this location
      cleanupAllOperations();
      const startPt = { lat: userLocation[0], lng: userLocation[1], name: 'Current Location' };
      const endPt = { lat: endLat, lng: endLon, name: endLocation };
      findPath(startPt, endPt);
      setObstacleHandled(true);
    }
  }, [detectionRunning, userLocation, objects, obstacleHandled]);
  
  // Add X icon for obstacle marker
  const XIcon = L.divIcon({
    className: 'custom-x-icon',
    html: '<div style="color:red;font-size:24px;transform:translate(-50%,-50%)">×</div>'
  });
  
  return (
    <div className={`app ${placingObstacle ? 'placing-obstacle' : ''}`}>
      <MapContainer 
        center={DEFAULT_CENTER}
        zoom={16}
        style={{ height: '100vh', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomright" />
        
        {/* Map controller to handle zoom on path change */}
        <MapController 
          path={path} 
          alternativePaths={alternativePaths}
          showAllPaths={showAllPaths}
          selectedPathIndex={selectedPathIndex}
          startMarker={startMarker} 
          endMarker={endMarker} 
          obstacles={obstacles}
          userLocation={userLocation}
          followUser={followUser}
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
        
        {/* Obstacles */}
        {obstacles.map((obstacle, index) => (
          <Marker key={obstacle.id} position={obstacle.position} icon={XIcon}>
            <Tooltip direction="top">Obstacle</Tooltip>
          </Marker>
        ))}
        
        {/* User location from real GPS */}
        {userLocation && userLocation.length === 2 && (
          <div className="user-location">
            <Circle 
              center={userLocation} 
              radius={4}
              color="#0078FF"
              fillColor="#0078FF"
              fillOpacity={1}
              weight={2}
              zIndex={100}
            />
            <Circle 
              center={userLocation} 
              radius={10}
              color="#0078FF"
              fillColor="#0078FF"
              fillOpacity={0.3}
              weight={1}
              zIndex={99}
            />
            {userHeading !== null && (
              <Polyline
                positions={[
                  userLocation,
                  [
                    userLocation[0] + 0.00005 * Math.cos(userHeading * Math.PI / 180),
                    userLocation[1] + 0.00005 * Math.sin(userHeading * Math.PI / 180)
                  ]
                ]}
                color="#0078FF"
                weight={2}
                opacity={0.8}
                zIndex={101}
              />
            )}
          </div>
        )}
        
        {/* Current location during simulation */}
        {simulationActive && !useRealLocation && currentLocation && currentLocation.length === 2 && (
          <Circle 
            center={currentLocation} 
            radius={5}
            color="#7ECFFF"
            fillColor="#7ECFFF"
            fillOpacity={0.8}
            weight={2}
          />
        )}
        
        {/* Follow User Button */}
        {userLocation && (
          <div className="follow-button-container">
            <button 
              className={`follow-button ${followUser ? 'active' : ''}`}
              onClick={toggleFollowUser}
              title={followUser ? "Stop following" : "Follow my location"}
            >
              <FontAwesomeIcon icon={faLocationArrow} />
            </button>
          </div>
        )}
        
        {/* Map click handler */}
        <MapUpdater 
          path={path}
          placingObstacle={placingObstacle}
          setObstacles={setObstacles}
          obstacleSize={DEFAULT_OBSTACLE_SIZE_METERS}
        />
      </MapContainer>
      
      {/* Mobile Controls Toggle Button */}
      <button 
        className="mobile-controls-toggle"
        onClick={toggleMobileControls}
        aria-label={mobileControlsVisible ? "Hide controls" : "Show controls"}
      >
        <FontAwesomeIcon icon={mobileControlsVisible ? faTimes : faBars} />
      </button>
      
      {/* Controls Panel */}
      <div className={`controls ${!mobileControlsVisible && isMobile ? 'mobile-hidden' : ''}`}>
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
        
        {/* GPS tracking buttons */}
        <div className="gps-tracking-buttons">
          {!useRealLocation ? (
            <button 
              className="full-width-button"
              onClick={startGPSTracking}
              style={{ backgroundColor: "#107C10" }}
            >
              Use My Real Location
            </button>
          ) : (
            <button 
              className="full-width-button"
              onClick={stopGPSTracking}
              style={{ backgroundColor: "#D83B01" }}
            >
              Stop Using My Location
            </button>
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
      
      {/* Video display for object detection */}
      <DetectionDisplay 
        videoRef={videoRef}
        detectionRunning={detectionRunning}
        objects={objects}
        obstacles={obstacles}
        clearObstacles={clearObstacles}
      />
      
      {/* Navigation Cards Container */}
      {(simulationActive || useRealLocation) && (
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