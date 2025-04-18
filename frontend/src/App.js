import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl, Circle, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import './App.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Config
// const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const DETECTION_URL = process.env.REACT_APP_DETECTION_URL || 'http://localhost:5001';
const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY || ''; // Add your GraphHopper API key
const openRouteServiceUrl = process.env.REACT_APP_OPENROUTE_URL || 'https://api.openrouteservice.org';
const openRouteServiceKey = process.env.REACT_APP_OPENROUTE_API_KEY || '5b3ce3597851110001cf6248ff8dd7d0d0954ae99bbeb48b86fbdf9b'; // Default demo key with limited usage
const DEFAULT_CENTER = [10.903831, 76.899839]; // Arjuna Statue at Amrita

// Amrita campus locations
const AMRITA_LOCATIONS = [
  {name: "A1 Staff Quarters", lat: 10.901408, lon: 76.900564},
  {name: "AB1", lat: 10.900501, lon: 76.902866},
  {name: "AB1 Car parking", lat: 10.900806, lon: 76.901861},
  {name: "AB1 Gym", lat: 10.901732, lon: 76.904144},
  {name: "AB2", lat: 10.903632, lon: 76.898394},
  {name: "AB3", lat: 10.906180, lon: 76.897778},
  {name: "AB4 - Amrita School of AI", lat: 10.904236, lon: 76.903576},
  {name: "Adithi Bhavanam", lat: 10.907319, lon: 76.898877},
  {name: "Advanced Multifunctional Materials and Analysis Lab", lat: 10.904150, lon: 76.898912},
  {name: "Aerospace Lab", lat: 10.902235, lon: 76.904414},
  {name: "Agasthya Bhavanam", lat: 10.902492, lon: 76.896217},
  {name: "Agasthya Bhavanam Mess", lat: 10.902944, lon: 76.896219},
  {name: "Amrita Ashram", lat: 10.902068, lon: 76.901058},
  {name: "Amrita Automotive Research and Testing Centre(AARTC)", lat: 10.903807, lon: 76.895610},
  {name: "Amrita Guest House", lat: 10.901419, lon: 76.898799},
  {name: "Amrita ICTS Office", lat: 10.900775, lon: 76.902631},
  {name: "Amrita Kripa Labs(CoE-AMGT)", lat: 10.901223, lon: 76.902384},
  {name: "Amrita Multi Dimensional Data Analytics Lab", lat: 10.900833, lon: 76.902765},
  {name: "Amrita Recycling Centre(ARC)", lat: 10.908921, lon: 76.90192},
  {name: "Amrita School of Business", lat: 10.904433, lon: 76.901833},
  {name: "Amrita School of physical Sciences", lat: 10.903792, lon: 76.898097},
  {name: "Amrita Sewage Treatment Plant", lat: 10.900125, lon: 76.900002},
  {name: "Amritanjali Hall", lat: 10.904666, lon: 76.899220},
  {name: "Amriteshwari Hall", lat: 10.900436, lon: 76.903798},
  {name: "Anokha hub", lat: 10.901236, lon: 76.901742},
  {name: "Anugraha Hall", lat: 10.906226, lon: 76.898032},
  {name: "Arjuna Statue", lat: 10.903831, lon: 76.899839},
  {name: "Ashram Office", lat: 10.902727, lon: 76.901229},
  {name: "Auditorium", lat: 10.904451, lon: 76.902588},
  {name: "B7B Quarters", lat: 10.908074, lon: 76.899355},
  {name: "Basketball Court 1", lat: 10.900774, lon: 76.904054},
  {name: "Basketball Court 2", lat: 10.901147, lon: 76.904080},
  {name: "Bhrigu Bhavanam", lat: 10.905331, lon: 76.904187},
  {name: "Binding Shop", lat: 10.904569, lon: 76.899354}
];

// Helper function to check if API keys are valid
const isApiKeyValid = (key) => {
  return key && key.length > 10;
};

// Helper component to update map view when path changes
function MapUpdater({ path }) {
  // eslint-disable-next-line no-unused-vars
  const map = useMap();
  
  useEffect(() => {
    if (path && path.length > 1) {
      try {
        console.log("Fitting map to path:", path);
        
        // Create Leaflet LatLng objects for the bounds
        const bounds = path.reduce(
          (bounds, point) => {
            // Convert point to LatLng if it's an array
            const latLng = Array.isArray(point) 
              ? L.latLng(point[0], point[1]) 
              : L.latLng(point.lat, point.lng);
            return bounds.extend(latLng);
          },
          L.latLngBounds(path[0], path[0])
        );
        
        // Add a small padding
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    }
  }, [path, map]);
  
  return null;
}

// Function to find the closest point on a path to a given point
// eslint-disable-next-line no-unused-vars
const findClosestPointOnPath = (point, path) => {
  const result = findClosestPointOnPathWithIndex(point, path);
  return result.point;
};

// Function to find the closest point on a path to a given point, returning segment index and progress
const findClosestPointOnPathWithIndex = (point, pathPoints) => {
  let closestPoint = null;
  let minDistance = Infinity;
  let segmentIndex = 0;
  let progress = 0;
  
  // If path or point is invalid, return a default value
  if (!point || !pathPoints || pathPoints.length < 2) {
    console.error("Invalid input to findClosestPointOnPathWithIndex", { point, pathLength: pathPoints?.length });
    return {
      point: point || [0, 0],
      segmentIndex: 0,
      progress: 0,
      distance: Infinity
    };
  }
  
  // Convert point to [lat, lng] format if it's not already
  const targetPoint = Array.isArray(point) ? point : [point.lat, point.lng];
  
  // Check each segment of the path
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const segmentStart = pathPoints[i];
    const segmentEnd = pathPoints[i + 1];
    
    // Find the closest point on this segment to the target point
    const closestOnSegment = findClosestPointOnSegment(targetPoint, segmentStart, segmentEnd);
    const distance = calculateDistance(targetPoint, closestOnSegment.point);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = closestOnSegment.point;
      segmentIndex = i;
      progress = closestOnSegment.progress;
    }
  }
  
  return {
    point: closestPoint,
    segmentIndex,
    progress,
    distance: minDistance
  };
};

// Find the closest point on a line segment
const findClosestPointOnSegment = (point, segmentStart, segmentEnd) => {
  const dx = segmentEnd[0] - segmentStart[0];
  const dy = segmentEnd[1] - segmentStart[1];
  
  // Handle case where segment is just a point
  if (dx === 0 && dy === 0) {
    return {
      point: segmentStart,
      progress: 0
    };
  }
  
  // Calculate projection of point onto segment
  const t = ((point[0] - segmentStart[0]) * dx + (point[1] - segmentStart[1]) * dy) / (dx * dx + dy * dy);
  
  // Constrain t to be within segment bounds
  const tConstrained = Math.max(0, Math.min(1, t));
  
  // Calculate the closest point
  const closestPoint = [
    segmentStart[0] + tConstrained * dx,
    segmentStart[1] + tConstrained * dy
  ];
  
  return {
    point: closestPoint,
    progress: tConstrained
  };
};

// Calculate distance between two points
const calculateDistance = (point1, point2) => {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Check if a point is near any obstacle
const isNearObstacle = (point, obstacles, threshold = 0.0002) => {
  if (!obstacles || obstacles.length === 0) return false;
  if (!point || !Array.isArray(point)) {
    console.error("Invalid point provided to isNearObstacle:", point);
    return false;
  }
  
  for (const obstacle of obstacles) {
    if (!obstacle || !obstacle.position || !Array.isArray(obstacle.position)) {
      continue; // Skip invalid obstacles
    }
    
    const latDiff = point[0] - obstacle.position[0];
    const lngDiff = point[1] - obstacle.position[1];
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    // Convert lat/lng distance to approximate meters (very rough approximation)
    // 0.0001 in lat/lng is roughly 11 meters
    const distanceInMeters = distance * 111000;
    
    // Minimum safe distance is the obstacle radius plus a small safety margin
    const safeDistance = obstacle.radius + 3; // 3 meter safety margin (reduced from 8)
    
    // Check if point is within the obstacle's safe distance
    if (distanceInMeters < safeDistance) {
      console.log("Obstacle reached! Distance:", distanceInMeters.toFixed(2), "meters");
      return true;
    }
  }
  return false;
};

// Function to check if any of the upcoming path segments might intersect with obstacles
// eslint-disable-next-line no-unused-vars
const checkPathSegmentsAhead = (currentPos, path, currentSegmentIndex, lookAheadSegments, obstacles) => {
  if (!obstacles || obstacles.length === 0 || !path || path.length < 2) return false;
  
  // Check the next few segments
  const maxSegmentToCheck = Math.min(currentSegmentIndex + lookAheadSegments, path.length - 1);
  
  console.log(`Checking ${maxSegmentToCheck - currentSegmentIndex} segments ahead for obstacles`);
  
  for (let i = currentSegmentIndex; i < maxSegmentToCheck; i++) {
    const segmentStart = i === currentSegmentIndex ? currentPos : path[i];
    const segmentEnd = path[i + 1];
    
    // Check each obstacle
    for (const obstacle of obstacles) {
      // Calculate minimum distance from obstacle to this segment
      const minDistance = minDistanceFromPointToLineSegment(
        obstacle.position, 
        segmentStart, 
        segmentEnd
      );
      
      // Convert to meters (rough approximation)
      const distanceInMeters = minDistance * 111000;
      
      // If path segment passes too close to obstacle
      if (distanceInMeters < obstacle.radius + 25) { // 25 meter safety margin
        console.log(`Future path segment ${i} will pass within ${distanceInMeters.toFixed(2)}m of an obstacle`);
        return true;
      }
    }
  }
  
  return false;
};

// Calculate minimum distance from a point to a line segment
const minDistanceFromPointToLineSegment = (point, lineStart, lineEnd) => {
  const [px, py] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  
  // Calculate line segment length squared
  const lineLength2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
  
  // If line segment is actually a point
  if (lineLength2 === 0) {
    return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
  }
  
  // Calculate projection of point on line segment
  const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLength2));
  
  // Calculate closest point on line segment
  const projectedX = x1 + t * (x2 - x1);
  const projectedY = y1 + t * (y2 - y1);
  
  // Calculate distance from original point to projected point
  return Math.sqrt(Math.pow(px - projectedX, 2) + Math.pow(py - projectedY, 2));
};

// Component to handle map clicks for placing obstacles
function ObstacleMarker({ obstacles, setObstacles, placingObstacle, obstacleSizeMeters }) {
  const map = useMapEvents({
    click: (e) => {
      if (placingObstacle) {
        const newObstacle = {
          id: Date.now(),
          position: [e.latlng.lat, e.latlng.lng],
          radius: obstacleSizeMeters // Use the size from props
        };
        console.log("Adding obstacle:", newObstacle);
        
        // Add the obstacle
        setObstacles(prev => [...prev, newObstacle]);
        
        // Dispatch a custom event to notify the main component about the new obstacle
        const customEvent = new CustomEvent('obstacleadded', { 
          detail: { obstacle: newObstacle }
        });
        window.dispatchEvent(customEvent);
      }
    }
  });
  
  return null;
}

// Function to check if a line segment intersects with an obstacle
const checkPathObstacleIntersection = (point1, point2, obstacles) => {
  if (!obstacles || obstacles.length === 0) return false;
  
  for (const obstacle of obstacles) {
    // Check if either endpoint is within the obstacle
    if (isPointInObstacle(point1, obstacle) || isPointInObstacle(point2, obstacle)) {
      return true;
    }
    
    // Check if the line segment intersects the obstacle
    // This is a simplified approach that checks points along the line segment
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const interpolatedPoint = [
        point1[0] + (point2[0] - point1[0]) * t,
        point1[1] + (point2[1] - point1[1]) * t
      ];
      
      if (isPointInObstacle(interpolatedPoint, obstacle)) {
        return true;
      }
    }
  }
  
  return false;
};

// Check if a point is within an obstacle
const isPointInObstacle = (point, obstacle) => {
  const latDiff = point[0] - obstacle.position[0];
  const lngDiff = point[1] - obstacle.position[1];
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  
  // Convert lat/lng distance to approximate meters
  const distanceInMeters = distance * 111000;
  
  // Detect ANY obstacle regardless of size - use minimum 1 meter for very small obstacles
  return distanceInMeters < Math.max(1, obstacle.radius);
};

// Define custom icons for markers
const createLocationIcon = () => {
  return L.divIcon({
    className: 'current-location-marker',
    html: `<div class="pulse"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

const createStartIcon = () => {
  return L.divIcon({
    className: 'start-marker',
    html: `<div class="start-icon">A</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const createEndIcon = () => {
  return L.divIcon({
    className: 'end-marker',
    html: `<div class="end-icon">B</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const createWaypointIcon = (index) => {
  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div class="waypoint-icon">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Function to get a color for different paths
const getPathColor = (index) => {
  const colors = [
    '#0078D7', // Blue (primary)
    '#107C10', // Green
    '#D83B01', // Orange/Red
    '#5C2D91', // Purple
    '#00B294', // Teal
    '#C239B3', // Magenta
    '#FFB900', // Gold
    '#E81123', // Red
    '#4A154B', // Deep Purple
    '#2D7D9A'  // Steel Blue
  ];
  
  // Use index as is if within range, or cycle through colors for larger indices
  return colors[index % colors.length];
};

// Function to find intersections between paths and create nodes
const findPathIntersections = (paths) => {
  if (!paths || paths.length < 2) return [];
  
  const intersections = [];
  const threshold = 0.00005; // Approximately 5 meters in lat/lng
  
  // Compare each path with every other path
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const path1 = paths[i].path;
      const path2 = paths[j].path;
      
      // Check each segment of the first path against each segment of the second path
      for (let p1 = 0; p1 < path1.length - 1; p1++) {
        for (let p2 = 0; p2 < path2.length - 1; p2++) {
          const seg1Start = path1[p1];
          const seg1End = path1[p1 + 1];
          const seg2Start = path2[p2];
          const seg2End = path2[p2 + 1];
          
          // Find if the segments are close to each other at any point
          for (let t1 = 0; t1 <= 1; t1 += 0.1) {
            const point1 = [
              seg1Start[0] + (seg1End[0] - seg1Start[0]) * t1,
              seg1Start[1] + (seg1End[1] - seg1Start[1]) * t1
            ];
            
            for (let t2 = 0; t2 <= 1; t2 += 0.1) {
              const point2 = [
                seg2Start[0] + (seg2End[0] - seg2Start[0]) * t2,
                seg2Start[1] + (seg2End[1] - seg2Start[1]) * t2
              ];
              
              // Calculate distance between points
              const distance = Math.sqrt(
                Math.pow(point1[0] - point2[0], 2) + 
                Math.pow(point1[1] - point2[1], 2)
              );
              
              // If points are close enough, consider it an intersection
              if (distance < threshold) {
                // Take average of the points as the intersection node
                const node = {
                  position: [
                    (point1[0] + point2[0]) / 2,
                    (point1[1] + point2[1]) / 2
                  ],
                  pathIndices: [i, j],
                  segmentIndices: [p1, p2],
                  progress: [t1, t2]
                };
                
                // Check if we already have a very similar node
                const isDuplicate = intersections.some(existing => {
                  const nodeDist = Math.sqrt(
                    Math.pow(existing.position[0] - node.position[0], 2) +
                    Math.pow(existing.position[1] - node.position[1], 2)
                  );
                  return nodeDist < threshold;
                });
                
                if (!isDuplicate) {
                  intersections.push(node);
                }
                
                // Only need to find one intersection per segment pair
                break;
              }
            }
          }
        }
      }
    }
  }
  
  console.log(`Found ${intersections.length} intersection nodes between paths`);
  return intersections;
};

// Find path intersection nodes between two paths
// eslint-disable-next-line no-unused-vars
const findPathIntersectionNode = (currentPath, newPath) => {
  if (!currentPath || !newPath || currentPath.length < 2 || newPath.length < 2) {
    return null;
  }
  
  const threshold = 0.00005; // Approximately 5 meters in lat/lng
  
  // Find where the paths diverge by checking each point in both paths
  for (let i = 0; i < currentPath.length; i++) {
    for (let j = 0; j < newPath.length; j++) {
      const distance = Math.sqrt(
        Math.pow(currentPath[i][0] - newPath[j][0], 2) + 
        Math.pow(currentPath[i][1] - newPath[j][1], 2)
      );
      
      if (distance < threshold) {
        // Found a common point - this is where paths intersect
        console.log(`Found intersection at current path point ${i} and new path point ${j}`);
        return {
          position: currentPath[i],
          currentPathIndex: i,
          newPathIndex: j
        };
      }
    }
  }
  
  return null;
};

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
  
  // State for path and map
  const [path, setPath] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_CENTER);
  const [alternativePaths, setAlternativePaths] = useState([]); // Store all available paths
  const [selectedPathIndex, setSelectedPathIndex] = useState(0); // Currently selected path index
  const [showPathOptions, setShowPathOptions] = useState(false); // Whether to show path options modal
  
  // State for markers and routing
  const [startMarker, setStartMarker] = useState(null);
  const [endMarker, setEndMarker] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [route, setRoute] = useState(null);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState(null);
  const [simulationActive, setSimulationActive] = useState(false);
  
  // State for detection service
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [objects, setObjects] = useState([]);
  
  // Refs
  const videoRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  
  // State for closest points on path to markers
  const [startPathPoint, setStartPathPoint] = useState(null);
  const [endPathPoint, setEndPathPoint] = useState(null);
  
  // State for obstacles and obstacle placement
  const [obstacles, setObstacles] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [placingObstacle, setPlacingObstacle] = useState(false);
  const OBSTACLE_SIZE_METERS = 5; // Fixed obstacle size
  
  // Add state for movement history trail
  const [movementTrail, setMovementTrail] = useState([]);
  const MAX_TRAIL_LENGTH = 50; // Keep last 50 positions in the trail
  
  // Add state for simulation control and tracking
  const [rerouteAttempts, setRerouteAttempts] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed increment percentage per step
  const [simulationIntervalMs, setSimulationIntervalMs] = useState(100); // Milliseconds between simulation steps
  
  // State for path intersection nodes
  // eslint-disable-next-line no-unused-vars
  const [pathNodes, setPathNodes] = useState([]);
  
  // State for obstacle popup info
  // eslint-disable-next-line no-unused-vars
  const [obstaclePopupInfo, setObstaclePopupInfo] = useState(null);
  
  // Function to find path between two points using GraphHopper
  const findPath = async (start, end) => {
    try {
      setRerouting(true);
      setError(null);
      
      // Reset route state
      setRoute(null);
      setWaypoints([]);
      setAlternativePaths([]); // Reset alternative paths
      setPathNodes([]); // Reset path nodes
      
      // Set markers with proper coordinate conversion
      const startMarkerPos = {
        lat: parseFloat(start.lat),
        lng: parseFloat(start.lon || start.lng)
      };
      const endMarkerPos = {
        lat: parseFloat(end.lat),
        lng: parseFloat(end.lon || end.lng)
      };
      
      setStartMarker({ position: startMarkerPos, label: 'A' });
      setEndMarker({ position: endMarkerPos, label: 'B' });
      
      console.log(`Finding path from ${JSON.stringify(start)} to ${JSON.stringify(end)}...`);
      
      // Create the GraphHopper API URL with multiple alternative routes
      const url = `https://graphhopper.com/api/1/route?` +
        `point=${start.lat},${start.lon || start.lng}&` +
        `point=${end.lat},${end.lon || end.lng}&` +
        `vehicle=foot&` +
        `calc_points=true&` +
        `points_encoded=false&` +
        `algorithm=alternative_route&` +
        `alternative_route.max_paths=5&` + // Increased for more options
        `alternative_route.max_weight_factor=2.0&` + // Allow paths up to 2x the optimal weight
        `alternative_route.max_share_factor=0.8&` + // Limit shared segments between alternatives
        `ch.disable=true&` +
        `key=${GRAPHHOPPER_API_KEY}`;
      
      console.log(`Requesting route from GraphHopper: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.paths && data.paths.length > 0) {
        console.log("Route data received:", data);
        
        // Store all paths with metadata for later use
        let pathOptions = data.paths.map((path, index) => {
          const pathCoordinates = path.points.coordinates.map(coord => [coord[1], coord[0]]);
          // Count obstacle intersections
          let intersectionCount = 0;
          for (let i = 0; i < pathCoordinates.length - 1; i++) {
            if (checkPathObstacleIntersection(pathCoordinates[i], pathCoordinates[i+1], obstacles)) {
              intersectionCount++;
            }
          }
          
          return {
            index,
            path: pathCoordinates,
            distance: path.distance,
            time: path.time / 1000 / 60,
            coordinates: path.points.coordinates,
            intersectionCount,
            hasObstacles: intersectionCount > 0
          };
        });
        
        // Filter out duplicates by comparing path distance and length
        // Two paths are considered duplicates if their distance differs by less than 10 meters
        // and they have the same number of coordinates
        pathOptions = pathOptions.filter((path, index, self) => {
          return self.findIndex(p => 
            Math.abs(p.distance - path.distance) < 10 && 
            p.path.length === path.path.length &&
            p.index < path.index
          ) === -1;
        });
        
        // Ensure we have at least one path
        if (pathOptions.length === 0) {
          pathOptions = data.paths.map((path, index) => {
            const pathCoordinates = path.points.coordinates.map(coord => [coord[1], coord[0]]);
            return {
              index,
              path: pathCoordinates,
              distance: path.distance,
              time: path.time / 1000 / 60,
              coordinates: path.points.coordinates,
              intersectionCount: 0,
              hasObstacles: false
            };
          }).slice(0, 1);
        }
        
        // Sort paths by obstacle intersections (fewer is better)
        pathOptions.sort((a, b) => {
          // First sort by obstacle intersections
          if (a.intersectionCount !== b.intersectionCount) {
            return a.intersectionCount - b.intersectionCount;
          }
          // If same number of intersections, sort by distance (shorter is better)
          return a.distance - b.distance;
        });
        
        // Store all alternative paths
        setAlternativePaths(pathOptions);
        
        // Find and store intersection nodes between paths
        if (pathOptions.length > 1) {
          const nodes = findPathIntersections(pathOptions);
          console.log("Path intersection nodes:", nodes);
          setPathNodes(nodes);
        }
        
        // Set the selected path index to 0 (best path)
        setSelectedPathIndex(0);
        
        // Use the best path by default (first after sorting)
        const bestPath = pathOptions[0];
        
        // Set the route with proper coordinate conversion
        const routePath = bestPath.path.map(coord => ({ lat: coord[0], lng: coord[1] }));
        setRoute({
          path: routePath,
          distance: bestPath.distance,
          time: bestPath.time,
          coordinates: bestPath.coordinates
        });
        
        // Set the path for visualization
        console.log("Setting path with coordinates:", bestPath.path);
        setPath(bestPath.path);
        
        // Add waypoints with proper coordinate conversion
        const waypoints = [];
        for (let i = 1; i < bestPath.path.length - 1; i += 3) {
          waypoints.push({
            position: { lat: bestPath.path[i][0], lng: bestPath.path[i][1] },
            label: `${Math.floor(i/3) + 1}`,
            name: `Waypoint ${Math.floor(i/3) + 1}`
          });
        }
        setWaypoints(waypoints);
        
        // Don't show path options - automatically use the best path
      } else {
        console.error("Invalid response from GraphHopper:", data);
        throw new Error("Could not get route from GraphHopper");
      }
    } catch (error) {
      console.error("Error finding path:", error);
      // Fall back to a direct path
      await createDirectPath(start, end);
      setError(`Unable to find optimal path. Using direct route: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setRerouting(false);
    }
  };
  
  // Function to switch to a different path
  const switchToPath = (pathIndex) => {
    if (pathIndex >= 0 && pathIndex < alternativePaths.length) {
      setSelectedPathIndex(pathIndex);
      const selectedPath = alternativePaths[pathIndex];
      
      // Update the current path
      setPath(selectedPath.path);
      
      // Update the route
      const routePath = selectedPath.path.map(coord => ({ lat: coord[0], lng: coord[1] }));
      setRoute({
        path: routePath,
        distance: selectedPath.distance,
        time: selectedPath.time,
        coordinates: selectedPath.coordinates
      });
      
      // Update waypoints
      const waypoints = [];
      for (let i = 1; i < selectedPath.path.length - 1; i += 3) {
        waypoints.push({
          position: { lat: selectedPath.path[i][0], lng: selectedPath.path[i][1] },
          label: `${Math.floor(i/3) + 1}`,
          name: `Waypoint ${Math.floor(i/3) + 1}`
        });
      }
      setWaypoints(waypoints);
      
      // Hide the path options modal
      setShowPathOptions(false);
    }
  };
  
  // Helper function to fall back to the selected route
  // eslint-disable-next-line no-unused-vars
  const fallbackToSelectedRoute = (selectedRoute, coords, pathCoordinates, distance, duration) => {
    setRoute({
      path: pathCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
      distance: distance,
      time: duration / 60,
      coordinates: coords
    });
    
    setPath(pathCoordinates);
    
    const waypoints = [];
    for (let i = 1; i < pathCoordinates.length - 1; i += 3) {
      waypoints.push({
        position: { lat: pathCoordinates[i][0], lng: pathCoordinates[i][1] },
        label: `${Math.floor(i/3) + 1}`,
        name: `Waypoint ${Math.floor(i/3) + 1}`
      });
    }
    setWaypoints(waypoints);
  };
  
  // Function to create a direct path between two points
  const createDirectPath = async (start, end) => {
    console.log("Attempting to create a path using GraphHopper fallback method");
    
    try {
      // Create a basic GraphHopper URL with simplified parameters
      const url = `https://graphhopper.com/api/1/route?` +
        `point=${start.lat},${start.lon || start.lng}&` +
        `point=${end.lat},${end.lon || end.lng}&` +
        `vehicle=foot&` +
        `calc_points=true&` +
        `points_encoded=false&` +
        `key=${GRAPHHOPPER_API_KEY}`;
      
      console.log(`Fallback routing with GraphHopper: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.paths && data.paths.length > 0) {
        const path = data.paths[0];
        const pathCoordinates = path.points.coordinates.map(coord => [coord[1], coord[0]]);
        
        setRoute({
          path: pathCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
          distance: path.distance,
          time: path.time / 1000 / 60, // Convert to minutes
          coordinates: path.points.coordinates
        });
        
        // Set the path for visualization
        console.log("Setting path with coordinates:", pathCoordinates);
        setPath(pathCoordinates);
        
        // Add waypoints for intermediate points
        const waypoints = [];
        for (let i = 1; i < pathCoordinates.length - 1; i += 3) {
          waypoints.push({
            position: { lat: pathCoordinates[i][0], lng: pathCoordinates[i][1] },
            label: `${Math.floor(i/3) + 1}`,
            name: `Waypoint ${Math.floor(i/3) + 1}`
          });
        }
        setWaypoints(waypoints);
        return;
      }
    } catch (error) {
      console.error("Fallback routing failed, creating a truly direct path:", error);
    }
    
    // If GraphHopper fails completely, create a simple direct path
    console.log("Creating direct point-to-point path with:", { start, end });
    
    // Validate inputs to prevent errors
    if (!start || !end) {
      console.error("Invalid inputs to createDirectPath:", { start, end });
      return;
    }
    
    const startPoint = { 
      lat: parseFloat(start.lat || 0), 
      lng: parseFloat(start.lng || start.lon || 0) 
    };
    
    const endPoint = { 
      lat: parseFloat(end.lat || 0), 
      lng: parseFloat(end.lng || end.lon || 0) 
    };
    
    console.log("Parsed points:", { startPoint, endPoint });
    
    // Create a simple path with a few interpolated points
    const pathCoordinates = [
      startPoint,
      {
        lat: startPoint.lat + (endPoint.lat - startPoint.lat) * 0.25,
        lng: startPoint.lng + (endPoint.lng - startPoint.lng) * 0.25
      },
      {
        lat: startPoint.lat + (endPoint.lat - startPoint.lat) * 0.5,
        lng: startPoint.lng + (endPoint.lng - startPoint.lng) * 0.5
      },
      {
        lat: startPoint.lat + (endPoint.lat - startPoint.lat) * 0.75,
        lng: startPoint.lng + (endPoint.lng - startPoint.lng) * 0.75
      },
      endPoint
    ];
    
    // Calculate a rough distance (in meters) using Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = startPoint.lat * Math.PI/180;
    const φ2 = endPoint.lat * Math.PI/180;
    const Δφ = (endPoint.lat - startPoint.lat) * Math.PI/180;
    const Δλ = (endPoint.lng - startPoint.lng) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Estimate time (5km/h walking speed = 83.3m/min)
    const estimatedTime = distance / 83.3;
    
    setRoute({
      path: pathCoordinates,
      distance: distance,
      time: estimatedTime,
      isDirectPath: true
    });
    
    // Set the path for visualization on the map
    console.log("Setting path with coordinates:", pathCoordinates);
    const mapPath = pathCoordinates.map(coord => [coord.lat, coord.lng]);
    console.log("Map path format:", mapPath);
    setPath(mapPath);
    
    // Add waypoints for the intermediate points
    setWaypoints(pathCoordinates.slice(1, -1).map((coord, idx) => ({
      position: { lat: coord.lat, lng: coord.lng },
      label: `${idx + 1}`,
      name: `Waypoint ${idx + 1}`
    })));
  };
  
  // Function to handle start location change
  const handleStartLocationChange = (e) => {
    const locationName = e.target.value;
    setStartLocation(locationName);
    
    const location = AMRITA_LOCATIONS.find(loc => loc.name === locationName);
    if (location) {
      setStartLat(location.lat.toString());
      setStartLon(location.lon.toString());
    }
  };
  
  // Function to handle end location change
  const handleEndLocationChange = (e) => {
    const locationName = e.target.value;
    setEndLocation(locationName);
    
    const location = AMRITA_LOCATIONS.find(loc => loc.name === locationName);
    if (location) {
      setEndLat(location.lat.toString());
      setEndLon(location.lon.toString());
    }
  };
  
  // Function to start detection
  const startDetection = async () => {
    try {
      // Call backend to start detection
      const response = await axios.post(`${DETECTION_URL}/start`, {
        camera_url: "rtsp://localhost:8554/stream"
      });
      
      if (response.data.status === 'success') {
        setDetectionRunning(true);
        
        // Start fetching video frames and detected objects periodically
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
        
        frameIntervalRef.current = setInterval(async () => {
          try {
            // Fetch video frame
            const frameResponse = await axios.get(`${DETECTION_URL}/frame`, {
              responseType: 'blob'
            });
            if (videoRef.current) {
              videoRef.current.src = URL.createObjectURL(frameResponse.data);
            }
            
            // Fetch detected objects
            const objectsResponse = await axios.get(`${DETECTION_URL}/objects`);
            setObjects(objectsResponse.data.objects || []);
            
            // Fetch detected obstacles if simulation is active
            if (simulationActive) {
              // Update current location on the backend
              await axios.post(`${DETECTION_URL}/update-location`, {
                location: currentLocation
              });
              
              // Get obstacles with mapped GPS positions
              const obstaclesResponse = await axios.get(`${DETECTION_URL}/obstacles`);
              const detectedObstacles = obstaclesResponse.data.obstacles || [];
              
              // Only handle new obstacles when they appear
              if (detectedObstacles.length > 0) {
                handleDetectedObstacles(detectedObstacles);
              }
            }
          } catch (error) {
            console.error('Error fetching detection data:', error);
          }
        }, 500); // Check every 500ms
      } else {
        alert('Error starting detection: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error starting detection:', error);
      alert('Error starting detection: ' + error.message);
    }
  };
  
  // Function to stop detection
  const stopDetection = async () => {
    try {
      const response = await axios.post(`${DETECTION_URL}/stop`);
      if (response.data.status === 'success') {
        setDetectionRunning(false);
        
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
      } else {
        alert('Error stopping detection: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error stopping detection:', error);
      alert('Error stopping detection: ' + error.message);
      // Still cleanup even if API call fails
      setDetectionRunning(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);
  
  // Function to clean up all operations
  const cleanupAllOperations = () => {
    // Clear any existing simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
      setSimulationActive(false);
    }
    
    // Reset state
    setRerouteAttempts(0);
    setMovementTrail([]);
  };
  
  // Function to start simulation from a specific point on the path
  const startSimulationFromPoint = (startSegmentIndex, startProgressPercentage) => {
    if (!path || path.length < 2) {
      console.error("No valid path to simulate");
      return false;
    }
    
    console.log(`Starting simulation from segment ${startSegmentIndex} with progress ${startProgressPercentage}%, path length: ${path.length}`);
    
    setSimulationActive(true);
    
    // Keep track of which segment we're on and our progress within it
    let currentSegmentIndex = startSegmentIndex;
    let progressPercentage = startProgressPercentage;
    
    // Direction of movement - start with forward
    let isMovingForward = true;
    
    if (simulationIntervalRef.current) {
      console.log("Clearing existing interval before starting new one");
      clearInterval(simulationIntervalRef.current);
    }
    
    // Create a new interval for the simulation
    const simulationInterval = setInterval(() => {
      // Always get the current path from state to ensure we're using the most up-to-date path
      // This allows us to follow the new path after rerouting
      
      if (!simulationActive) {
        console.log("Simulation paused, waiting for resume");
        return;
      }
      
      try {
        // Access the current path from state
      const currentPath = path;
      
      if (!currentPath || currentPath.length < 2) {
          console.error("Invalid path during simulation interval");
          clearInterval(simulationInterval);
        return;
      }
      
        // Calculate the current and next position based on path and progress
        let startPoint, endPoint;
        
        if (isMovingForward) {
          // Normal forward movement
          startPoint = currentPath[currentSegmentIndex];
          endPoint = currentPath[currentSegmentIndex + 1];
        } else {
          // Backward movement - reverse the points
          startPoint = currentPath[currentSegmentIndex + 1];
          endPoint = currentPath[currentSegmentIndex];
        }
        
        if (!startPoint || !endPoint) {
          console.error("Invalid path points in simulation");
          clearInterval(simulationInterval);
        return;
      }
      
        // Interpolate between start and end based on progress percentage
        const currentPosition = [
          startPoint[0] + (endPoint[0] - startPoint[0]) * (progressPercentage / 100),
          startPoint[1] + (endPoint[1] - startPoint[1]) * (progressPercentage / 100)
        ];
        
        // Update position on the map
        setCurrentLocation(currentPosition);
        
        // Add to movement trail (but limit the size to avoid memory issues)
        setMovementTrail(prev => {
          const updated = [...prev, currentPosition];
          return updated.slice(-100); // Keep only the last 100 positions
        });
        
        // Check if we've encountered an obstacle
        if (isNearObstacle(currentPosition, obstacles, 3.0)) {
          console.log("Obstacle detected during simulation, automatically rerouting");
          
          // Don't pause the simulation
          // Just store the current position for rerouting
          const obstaclePosition = currentPosition;
          
          // Immediately trigger rerouting without user interaction
          handleRerouting(obstaclePosition).then(success => {
            if (!success) {
              console.error("Failed to reroute after obstacle");
              setSimulationActive(false);
              alert("Unable to find a viable path around obstacles. Please try clearing obstacles or choosing a different route.");
            }
            // If successful, simulation will continue with the new path
          }).catch(error => {
            console.error("Error during automatic rerouting:", error);
            setSimulationActive(false);
          });
          
          // Clear the interval but don't set simulationActive to false
          // The handleRerouting function will restart the simulation with the new path
          clearInterval(simulationInterval);
          return;
        }
      
        // Advance progress for the next iteration
        progressPercentage += simulationSpeed;
        
        // Check if we've completed the current segment
        if (progressPercentage >= 100) {
          // Reset progress and move to the next segment
          progressPercentage = 0;
          
          if (isMovingForward) {
            // Moving forward - increment segment index
            currentSegmentIndex += 1;
        
        // Check if we've reached the end of the path
        if (currentSegmentIndex >= currentPath.length - 1) {
              console.log("Reached destination, ending simulation");
              clearInterval(simulationInterval);
          setSimulationActive(false);
          return;
        }
          } else {
            // Moving backward - decrement segment index
            currentSegmentIndex -= 1;
            
            // Check if we've reached the beginning of the path
            if (currentSegmentIndex < 0) {
              console.log("Reached beginning of path while moving backward, switching to forward");
              currentSegmentIndex = 0;
              isMovingForward = true;
            }
          }
        }
      } catch (error) {
        console.error("Error in simulation loop:", error);
        clearInterval(simulationInterval);
      }
    }, simulationIntervalMs);
    
    // Save the interval reference to clear it later
    simulationIntervalRef.current = simulationInterval;
    return true;
  };
  
  // Function to simulate movement along the path with obstacle avoidance
  const simulateMovement = async () => {
    console.log("simulateMovement called");
    
    // First ensure we have a valid path
    if (!path || path.length < 2) {
      console.error("Cannot simulate: no valid path exists");
      alert('Please find a path first');
      return;
    }
    
    // Next ensure start and end location data is properly formatted
    if (!startLocation || !endLocation) {
      console.error("Start or end location is missing");
      alert('Please set start and end locations');
      return;
    }
    
    // Clear any existing simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    
    // Reset simulation state
    setRerouteAttempts(0);
    setMovementTrail([]);
    setSimulationActive(true);
    
    // Start object detection if it's not already running
    if (!detectionRunning) {
      try {
        await startDetection();
      } catch (error) {
        console.error("Failed to start detection:", error);
        // Continue with simulation even if detection fails
      }
    }
    
    try {
      // Start simulation directly with the current path without checking for obstacles beforehand
      console.log("Starting simulation on current path");
      const startPoint = path[0];
      setMovementTrail([startPoint]);
      setCurrentLocation(startPoint);
      
      setTimeout(() => {
        const success = startSimulationFromPoint(0, 0);
        if (!success) {
          console.error("Failed to start simulation");
          setSimulationActive(false);
          alert("Failed to start simulation. Please try finding a new path.");
        }
      }, 500);
    } catch (error) {
      console.error("Error in simulation startup:", error);
      setSimulationActive(false);
      alert(`Simulation error: ${error.message}`);
    }
  };
  
  // Function to clear all obstacles
  const clearObstacles = () => {
    setObstacles([]);
  };
  
  // Update closest points whenever path or markers change
  useEffect(() => {
    if (path.length > 0 && startMarker && endMarker) {
      // Find closest point on path to start marker
      const closestToStart = findClosestPointOnPathWithIndex(
        [startMarker.position.lat, startMarker.position.lng], 
        path
      );
      
      // Find closest point on path to end marker
      const closestToEnd = findClosestPointOnPathWithIndex(
        [endMarker.position.lat, endMarker.position.lng], 
        path
      );
      
      setStartPathPoint(closestToStart);
      setEndPathPoint(closestToEnd);
    }
  }, [path, startMarker, endMarker]);
  
  // Function to handle rerouting when an obstacle is detected
  const handleRerouting = async (currentPos) => {
    console.log("Handling rerouting from position:", currentPos);
    
    // First, verify we have valid destination data
    if (!endMarker) {
      console.error("Cannot reroute: missing end marker");
      return false;
    }
    
    // We keep the simulation active during rerouting
    // This creates smoother transitions between paths
    
    // Check if we have a valid API key for OpenRouteService
    if (!isApiKeyValid(openRouteServiceKey)) {
      console.error("OpenRouteService API key is missing or invalid");
      return false;
    }
    
    try {
      // Increment reroute attempts counter to prevent infinite rerouting
      const currentAttempts = rerouteAttempts + 1;
      setRerouteAttempts(currentAttempts);
      
      if (currentAttempts > 3) {
        console.error("Too many reroute attempts, giving up");
        alert("Unable to find a viable path after multiple attempts. Please try clearing obstacles or finding a new path.");
        return false;
      }
      
      // Create a node at the current position where the obstacle was detected
      const obstacleNode = {
        position: { lat: currentPos[0], lng: currentPos[1] },
        label: `O`,
        name: `Obstacle Node`
      };
      
      // Always set the current obstacle position as the new starting point
      console.log("Setting obstacle position as new starting location");
      setStartLocation({
        lat: currentPos[0],
        lng: currentPos[1]
      });
      
      // Update the start marker to the new position
      if (startMarker) {
        // Update the actual start marker to the current position
        setStartMarker({
          ...startMarker,
          position: { lat: currentPos[0], lng: currentPos[1] },
          name: 'New Start (Obstacle Point)'
        });
      }
      
      // First, check if we have any alternative paths that avoid obstacles
      if (alternativePaths && alternativePaths.length > 1) {
        console.log("Checking existing alternative paths to avoid obstacles...");
        
        // Find alternative paths that don't intersect with obstacles
        const viablePaths = alternativePaths.filter((pathOption, index) => {
          // Skip the current path as it contains an obstacle
          if (index === selectedPathIndex) return false;
          
          // Check if this alternative path avoids all obstacles
          for (let i = 0; i < pathOption.path.length - 1; i++) {
            if (checkPathSegmentAgainstObstacles(pathOption.path[i], pathOption.path[i+1], obstacles)) {
              return false;
            }
          }
          return true;
        });
        
        console.log(`Found ${viablePaths.length} viable alternative paths`);
        
        if (viablePaths.length > 0) {
          // Sort by distance and use the shortest path
          viablePaths.sort((a, b) => a.distance - b.distance);
          const bestPath = viablePaths[0];
          
          console.log(`Switching to alternative path ${bestPath.index} that avoids the obstacle`);
          
          // Find the closest point on the alternative path to our current position
            const closestPoint = findClosestPointOnPathWithIndex(currentPos, bestPath.path);
          
          // Create a new path from the current position to the destination
          // We'll take the alternative path starting from the closest point
          const newPathFromObstacle = [
            // Start with the current position (obstacle point)
            currentPos,
            // Then add all points from the closest point on the alternative path to the end
            ...bestPath.path.slice(closestPoint.segmentIndex)
          ];
          
          console.log(`Created new path from obstacle with ${newPathFromObstacle.length} points`);
          
          // Update waypoints - include the obstacle node and add waypoints along the new path
          const waypointsArray = [obstacleNode];
          
          // Add waypoints along the new path
          for (let i = 2; i < newPathFromObstacle.length - 1; i += 3) {
            waypointsArray.push({
              position: { lat: newPathFromObstacle[i][0], lng: newPathFromObstacle[i][1] },
              label: `${waypointsArray.length}`,
              name: `Waypoint ${waypointsArray.length}`
            });
          }
          
          // Update all state in a single batch to ensure consistency
          await Promise.all([
            // Update the path
            new Promise(resolve => {
              setPath(newPathFromObstacle);
              setTimeout(resolve, 100);
            }),
            
            // Set selected path index
            new Promise(resolve => {
          setSelectedPathIndex(bestPath.index);
              setTimeout(resolve, 100);
            }),
            
            // Update waypoints
            new Promise(resolve => {
              setWaypoints(waypointsArray);
              setTimeout(resolve, 100);
            }),
            
            // Update the display route
            new Promise(resolve => {
              setRoute({
                path: newPathFromObstacle.map(coord => ({ lat: coord[0], lng: coord[1] })),
                distance: bestPath.distance,
                time: bestPath.time,
                coordinates: newPathFromObstacle
              });
              setTimeout(resolve, 100);
            })
          ]);
          
          // Wait for state updates to fully propagate
          console.log("State updated with new path, continuing simulation...");
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Continue simulation from the obstacle point - it will use the updated path
          console.log("Continuing simulation from obstacle point");
          
          // Restart the simulation at the obstacle point (index 0 of the new path)
          continueSimulationFromObstacle();
          return true;
        }
      }
      
      // If no alternative paths are available, then create a new route from the current position
      console.log("No viable existing alternatives found, requesting new route from obstacle point to destination...");
      
      const endCoordinates = [endMarker.position.lat, endMarker.position.lng];
      
      try {
        // Request new route from OpenRouteService
        const response = await axios.get(`${openRouteServiceUrl}/v2/directions/foot-walking`, {
          params: {
            api_key: openRouteServiceKey,
            start: `${currentPos[1]},${currentPos[0]}`,
            end: `${endCoordinates[1]},${endCoordinates[0]}`,
            alternatives: true,
            options: JSON.stringify({ 
              avoid_features: ["steps", "fords"],
              avoid_polygons: createAvoidancePolygonsFromObstacles(obstacles, 2.0)
            })
          }
        });
        
        if (response.data && response.data.features && response.data.features.length > 0) {
          // Convert coordinates and create new paths
          const newPaths = response.data.features.map((feature, index) => ({
            index,
            path: feature.geometry.coordinates.map(coord => [coord[1], coord[0]]),
            distance: feature.properties.summary.distance,
            time: feature.properties.summary.duration / 60,
            hasObstacles: false
          }));
          
          // Find paths that don't intersect with obstacles
          const validPaths = newPaths.filter(pathOption => {
            for (let i = 0; i < pathOption.path.length - 1; i++) {
              if (checkPathSegmentAgainstObstacles(pathOption.path[i], pathOption.path[i+1], obstacles)) {
                return false;
              }
            }
            return true;
          });
          
          if (validPaths.length > 0) {
            // Sort by distance and use shortest path
            validPaths.sort((a, b) => a.distance - b.distance);
            const bestPath = validPaths[0];
            
            // Create a new path starting exactly from the current position
            const newPathFromObstacle = [
              currentPos,  // Start with the obstacle point
              ...bestPath.path.slice(1)  // Then add the rest of the path
            ];
            
            console.log(`Created new API path with ${newPathFromObstacle.length} points from obstacle position`);
            
            // Create waypoints along the new path - start with the obstacle node
            const waypointsArray = [obstacleNode];
            
            // Add waypoints every few points to make the path clear
            for (let i = 2; i < newPathFromObstacle.length - 1; i += 3) {
              waypointsArray.push({
                position: { lat: newPathFromObstacle[i][0], lng: newPathFromObstacle[i][1] },
                label: `${waypointsArray.length}`,
                name: `Waypoint ${waypointsArray.length}`
              });
            }
            
            // Update all state in a single batch to ensure consistency
            await Promise.all([
              // Update the path
              new Promise(resolve => {
                setPath(newPathFromObstacle);
                setTimeout(resolve, 100);
              }),
              
              // Update alternatives and selected index
              new Promise(resolve => {
                setAlternativePaths(validPaths);
                setTimeout(resolve, 100);
              }),
              
              new Promise(resolve => {
                setSelectedPathIndex(0);
                setTimeout(resolve, 100);
              }),
              
              // Update waypoints
              new Promise(resolve => {
                setWaypoints(waypointsArray);
                setTimeout(resolve, 100);
              }),
              
              // Update route display
              new Promise(resolve => {
                setRoute({
                  path: newPathFromObstacle.map(coord => ({ lat: coord[0], lng: coord[1] })),
                  distance: bestPath.distance,
                  time: bestPath.time,
                  coordinates: newPathFromObstacle
                });
                setTimeout(resolve, 100);
              })
            ]);
            
            // Wait for state updates to complete
            console.log("State updated with new API path, continuing simulation...");
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Continue simulation from the obstacle point
            console.log("Continuing simulation from obstacle point");
            
            // Continue the simulation at the obstacle point (index 0 of the new path)
            continueSimulationFromObstacle();
            return true;
          }
        }
        
        // If no valid routes found, try with a more aggressive avoidance radius
        console.log("No valid routes found, trying with larger avoidance radius...");
        
        const fallbackResponse = await axios.get(`${openRouteServiceUrl}/v2/directions/foot-walking`, {
          params: {
            api_key: openRouteServiceKey,
            start: `${currentPos[1]},${currentPos[0]}`,
            end: `${endCoordinates[1]},${endCoordinates[0]}`,
            options: JSON.stringify({ 
              avoid_features: ["steps", "fords"],
              avoid_polygons: createAvoidancePolygonsFromObstacles(obstacles, 3.0)
            })
          }
        });
        
        if (fallbackResponse.data && fallbackResponse.data.features && fallbackResponse.data.features.length > 0) {
          const apiPath = fallbackResponse.data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          
          // Create a new path starting exactly from the current position
          const newPath = [
            currentPos,  // Start with the obstacle point
            ...apiPath.slice(1)  // Then add the rest of the API path
          ];
          
          console.log(`Created fallback path with ${newPath.length} points from obstacle position`);
          
          // Create waypoints along the new path - start with the obstacle node
          const waypointsArray = [obstacleNode];
          for (let i = 2; i < newPath.length - 1; i += 3) {
            waypointsArray.push({
              position: { lat: newPath[i][0], lng: newPath[i][1] },
              label: `${waypointsArray.length}`,
              name: `Waypoint ${waypointsArray.length}`
            });
          }
          
          // Update all state in a single batch to ensure consistency
          await Promise.all([
            // Update the path
            new Promise(resolve => {
          setPath(newPath);
              setTimeout(resolve, 100);
            }),
            
            // Update alternatives and selected index
            new Promise(resolve => {
          setAlternativePaths([{
            index: 0,
            path: newPath,
                distance: fallbackResponse.data.features[0].properties.summary.distance,
                time: fallbackResponse.data.features[0].properties.summary.duration / 60,
            hasObstacles: false
          }]);
              setTimeout(resolve, 100);
            }),
            
            new Promise(resolve => {
          setSelectedPathIndex(0);
              setTimeout(resolve, 100);
            }),
            
            // Update waypoints
            new Promise(resolve => {
              setWaypoints(waypointsArray);
              setTimeout(resolve, 100);
            }),
            
            // Update route display
            new Promise(resolve => {
              setRoute({
                path: newPath.map(coord => ({ lat: coord[0], lng: coord[1] })),
                distance: fallbackResponse.data.features[0].properties.summary.distance,
                time: fallbackResponse.data.features[0].properties.summary.duration / 60,
                coordinates: newPath
              });
              setTimeout(resolve, 100);
            })
          ]);
          
          // Wait for state updates to complete
          console.log("State updated with fallback path, continuing simulation...");
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Continue simulation from the obstacle point
          console.log("Continuing simulation from obstacle point");
          
          // Continue the simulation at the obstacle point (index 0 of the new path)
          continueSimulationFromObstacle();
          return true;
        }
      } catch (error) {
        console.error("Error finding new route:", error);
      }
      
      console.error("Failed to find any valid route from current position");
      return false;
    } catch (error) {
      console.error("Error in rerouting:", error);
      return false;
    }
  };
  
  // Helper function to continue simulation from obstacle point
  const continueSimulationFromObstacle = () => {
    // Start simulation at the beginning (index 0) of the new path
    // The new path already starts from the obstacle point
    startSimulationFromPoint(0, 0);
  };
  
  // Helper function to find the closest obstacle to a point
  // eslint-disable-next-line no-unused-vars
  const findClosestObstacle = (point, obstacles) => {
    if (!obstacles || obstacles.length === 0) return null;
    
    let closestObstacle = null;
    let minDistance = Infinity;
    
    for (const obstacle of obstacles) {
      const latDiff = point[0] - obstacle.position[0];
      const lngDiff = point[1] - obstacle.position[1];
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestObstacle = obstacle;
      }
    }
    
    return closestObstacle ? closestObstacle.position : null;
  };
  
  // Helper function to calculate waypoints to avoid an obstacle
  // eslint-disable-next-line no-unused-vars
  const calculateAvoidanceWaypoints = (startPoint, endPoint, obstaclePoint) => {
    // Convert points to arrays if they're not already
    const start = Array.isArray(startPoint) ? startPoint : [startPoint.lat, startPoint.lng];
    const end = Array.isArray(endPoint) ? endPoint : [endPoint[0], endPoint[1]];
    const obstacle = Array.isArray(obstaclePoint) ? obstaclePoint : [obstaclePoint[0], obstaclePoint[1]];
    
    // Calculate vector from start to end
    const dirX = end[0] - start[0];
    const dirY = end[1] - start[1];
    
    // Normalize direction vector
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normDirX = dirX / length;
    const normDirY = dirY / length;
    
    // Calculate perpendicular vector (90 degrees counterclockwise)
    const perpX = -normDirY;
    const perpY = normDirX;
    
    // Calculate distance to obstacle - multiply by 111000 to convert to approximate meters
    const obstDistX = obstacle[0] - start[0];
    const obstDistY = obstacle[1] - start[1];
    // eslint-disable-next-line no-unused-vars
    const obstacleDistance = Math.sqrt(obstDistX * obstDistX + obstDistY * obstDistY) * 111000;
    
    // Calculate offset distance (how far to go around the obstacle)
    // Use the obstacle radius plus a safety margin
    const closestObstacle = obstacles.find(obs => 
      obs.position[0] === obstacle[0] && obs.position[1] === obstacle[1]
    );
    const obstacleRadius = closestObstacle ? closestObstacle.radius : 5; // Default 5m
    const offsetDistance = (obstacleRadius + 20) / 111000; // Add 20m safety margin, convert to degrees
    
    // Calculate waypoints to go around the obstacle
    // We'll generate 2 waypoints - one to avoid the obstacle, another to get back on path
    const waypoint1 = [
      start[0] + normDirX * 0.5 * length + perpX * offsetDistance,
      start[1] + normDirY * 0.5 * length + perpY * offsetDistance
    ];
    
    const waypoint2 = [
      end[0] - normDirX * 0.3 * length + perpX * offsetDistance,
      end[1] - normDirY * 0.3 * length + perpY * offsetDistance
    ];
    
    return [waypoint1, waypoint2];
  };
  
  // Helper function to calculate path distance
  // eslint-disable-next-line no-unused-vars
  const calculatePathDistance = (path) => {
    if (!path || path.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += calculateDistanceBetweenPoints(path[i], path[i+1]);
    }
    
    return totalDistance;
  };
  
  // Helper to calculate distance between two points in meters
  const calculateDistanceBetweenPoints = (point1, point2) => {
    // Haversine formula to calculate distance between two lat/lng points
    const R = 6371e3; // Earth radius in meters
    const dLat = (point2[0] - point1[0]) * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };
  
  // Helper function to check if a path segment intersects with any obstacles
  const checkPathSegmentAgainstObstacles = (segmentStart, segmentEnd, obstacles) => {
    if (!obstacles || obstacles.length === 0) return false;
    
    for (const obstacle of obstacles) {
      // Calculate minimum distance from obstacle to line segment
      const distance = minDistanceFromPointToLineSegment(
        obstacle.position, 
        segmentStart, 
        segmentEnd
      );
      
      // Convert to meters (rough approximation)
      const distanceInMeters = distance * 111000;
      
      // Calculate segment length
      const segmentLengthMeters = calculateDistanceBetweenPoints(segmentStart, segmentEnd);
      
      // If path segment passes too close to obstacle
      if (distanceInMeters < obstacle.radius + 5) { // Reduced to 5m safety margin for precision
        // For short segments, do a more detailed check
        if (segmentLengthMeters < 30) { // For segments under 30m
          // Check multiple points along the segment
          const steps = 5;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = [
              segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * t,
              segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * t
            ];
            
            const pointToObstacle = Math.sqrt(
              Math.pow(point[0] - obstacle.position[0], 2) + 
              Math.pow(point[1] - obstacle.position[1], 2)
            ) * 111000;
            
            if (pointToObstacle < obstacle.radius) {
              return true;
            }
          }
        } else {
          // For longer segments, the initial distance check is sufficient
          return true;
        }
      }
    }
    
    return false; // Segment doesn't come too close to any obstacle
  };
  
  // Helper function to create GeoJSON polygons for obstacle avoidance
  const createAvoidancePolygonsFromObstacles = (obstacles, scaleFactor = 1.0) => {
    if (!obstacles || obstacles.length === 0) return [];
    
    return obstacles.map(obstacle => {
      // Create a simple circle approximation using 8 points
      const points = [];
      const radiusInDegrees = (obstacle.radius * scaleFactor) / 111000; // Convert meters to degrees (approximate)
      
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * 2 * Math.PI;
        points.push([
          obstacle.position[1] + radiusInDegrees * Math.cos(angle), // longitude
          obstacle.position[0] + radiusInDegrees * Math.sin(angle)  // latitude
        ]);
      }
      
      // Close the polygon
      points.push(points[0]);
      
      return {
        type: "Polygon",
        coordinates: [points]
      };
    });
  };
  
  // Add event listener for obstacle added
  useEffect(() => {
    // Function to handle obstacle added event
    const handleObstacleAdded = async (event) => {
      const newObstacle = event.detail.obstacle;
      console.log("Obstacle added event received:", newObstacle);
      
      // First check if we have a valid path
      if (!path || path.length < 2) {
        console.log("No valid path to check against new obstacle");
        return;
      }
      
      // Check if current path intersects with the new obstacle
      let pathAffected = false;
      
      // Check each segment of the path against the new obstacle
      for (let i = 0; i < path.length - 1; i++) {
        const segment = [path[i], path[i+1]];
        if (checkPathSegmentAgainstObstacles(segment[0], segment[1], [newObstacle])) {
          pathAffected = true;
          console.log(`Path segment ${i} intersects with the new obstacle`);
          break;
        }
      }
      
      // Also update the obstacle status for all alternative paths
      const updatedPaths = alternativePaths.map(pathOption => {
        let intersectionCount = 0;
        for (let i = 0; i < pathOption.path.length - 1; i++) {
          if (checkPathSegmentAgainstObstacles(
            pathOption.path[i], 
            pathOption.path[i+1], 
            obstacles
          )) {
            intersectionCount++;
          }
        }
        
        return {
          ...pathOption,
          intersectionCount,
          hasObstacles: intersectionCount > 0
        };
      });
      
      setAlternativePaths(updatedPaths);
      
      if (pathAffected) {
        console.log("Current path affected by new obstacle");
        
        if (simulationActive) {
          // If simulation is active, don't reroute immediately
          // Let the simulation encounter the obstacle naturally
          console.log("Simulation active - will reroute when obstacle is encountered");
        } else {
          // If not in simulation, suggest finding a new path but don't show options
          if (alternativePaths.length > 1) {
            // Don't automatically show path options when placing obstacles
            // setShowPathOptions(true);
            console.log("Path affected by new obstacle. Alternative paths available.");
          } else {
            // If no alternatives, suggest finding a new path
            alert("The path is now blocked by an obstacle. Please find a new path.");
          }
        }
      } else {
        console.log("Current path not affected by new obstacle");
      }
    };
    
    // Add event listener
    window.addEventListener('obstacleadded', handleObstacleAdded);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('obstacleadded', handleObstacleAdded);
    };
  }, [path, obstacles, alternativePaths, simulationActive, currentLocation, checkPathSegmentAgainstObstacles]);
  
  // Function to handle detected obstacles from camera feed
  const handleDetectedObstacles = (detectedObstacles) => {
    // Filter out obstacles that already exist (based on position)
    const newObstacles = detectedObstacles.filter(detected => {
      // Skip if we don't have valid position data
      if (!detected.position || !Array.isArray(detected.position) || detected.position.length !== 2) {
        return false;
      }
      
      // Check if this obstacle is already on the map (within a small distance)
      const isNew = !obstacles.some(existing => {
        const distance = Math.sqrt(
          Math.pow(existing.position[0] - detected.position[0], 2) +
          Math.pow(existing.position[1] - detected.position[1], 2)
        ) * 111000; // Convert to meters approximately
        
        // If within 10 meters, consider it the same obstacle
        return distance < 10;
      });
      
      return isNew;
    });
    
    // If we have new obstacles, add them and check if they're on our path
    if (newObstacles.length > 0) {
      console.log("New obstacles detected from camera:", newObstacles);
      
      // Create obstacle objects for the map
      const obstacleObjects = newObstacles.map(obstacle => ({
        id: obstacle.id,
        position: obstacle.position,
        radius: obstacle.radius || 5, // Default 5m radius
        class: obstacle.class
      }));
      
      // Add the new obstacles to our state
      setObstacles(prev => [...prev, ...obstacleObjects]);
      
      // Check if any of the new obstacles are on our current path
      const obstacleOnPath = obstacleObjects.some(obstacle => {
        // Check if this obstacle is near our current position or on our upcoming path
        return isNearObstacle(currentLocation, [obstacle], 10) || 
               checkPathSegmentsAhead(currentLocation, path, 0, 5, [obstacle]);
      });
      
      if (obstacleOnPath && simulationActive) {
        console.log("Detected obstacle on current path, pausing simulation");
        
        // Pause the simulation
        setSimulationActive(false);
        
        // Wait briefly before attempting to reroute
        setTimeout(async () => {
          console.log("Attempting to reroute around detected obstacle");
          
          // Find the closest obstacle to our current position
          const closestObstacle = newObstacles.reduce((closest, current) => {
            const distCurrent = Math.sqrt(
              Math.pow(currentLocation[0] - current.position[0], 2) +
              Math.pow(currentLocation[1] - current.position[1], 2)
            );
            
            const distClosest = closest ? Math.sqrt(
              Math.pow(currentLocation[0] - closest.position[0], 2) +
              Math.pow(currentLocation[1] - closest.position[1], 2)
            ) : Infinity;
            
            return distCurrent < distClosest ? current : closest;
          }, null);
          
          if (closestObstacle) {
            // Try to reroute around the obstacle
            const success = await handleRerouting(currentLocation);
            if (success) {
              // If rerouting was successful, resume simulation
              setTimeout(() => {
                console.log("Resuming simulation after rerouting");
                setSimulationActive(true);
              }, 1000);
            }
          }
        }, 500);
      }
    }
  };
  
  // eslint-disable-next-line no-unused-vars
  const handlePlacingObstacle = (placingState) => {
    // ... existing code ...
  };
  
  return (
    <div className="app">
      <div className="controls">
        <h2>Navigation Controls</h2>
        <div className="input-group">
          <label>Start Location</label>
          <select 
            value={startLocation} 
            onChange={handleStartLocationChange}
          >
            {AMRITA_LOCATIONS.map((loc) => (
              <option key={`start-${loc.name}`} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
          <div className="coordinates">
            <input 
              type="text" 
              placeholder="Latitude" 
              value={startLat} 
              onChange={(e) => setStartLat(e.target.value)} 
            />
            <input 
              type="text" 
              placeholder="Longitude" 
              value={startLon} 
              onChange={(e) => setStartLon(e.target.value)} 
            />
          </div>
        </div>
        
        <div className="input-group">
          <label>Destination</label>
          <select 
            value={endLocation} 
            onChange={handleEndLocationChange}
          >
            {AMRITA_LOCATIONS.map((loc) => (
              <option key={`end-${loc.name}`} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
          <div className="coordinates">
            <input 
              type="text" 
              placeholder="Latitude" 
              value={endLat} 
              onChange={(e) => setEndLat(e.target.value)} 
            />
            <input 
              type="text" 
              placeholder="Longitude" 
              value={endLon} 
              onChange={(e) => setEndLon(e.target.value)} 
            />
          </div>
        </div>
        
        <div className="buttons">
          <button onClick={() => {
            cleanupAllOperations();
            // Create start and end objects from the current values
            const start = {
              lat: startLat,
              lng: startLon,
              lon: startLon,
              name: startLocation
            };
            const end = {
              lat: endLat,
              lng: endLon,
              lon: endLon,
              name: endLocation
            };
            findPath(start, end);
          }}>Find Path</button>
          <button onClick={() => {
            cleanupAllOperations();
            simulateMovement();
          }}>Simulate Movement</button>
          {!detectionRunning ? (
            <button onClick={() => {
              cleanupAllOperations();
              startDetection();
            }}>Start Detection</button>
          ) : (
            <button onClick={() => {
              stopDetection();
              cleanupAllOperations();
            }}>Stop Detection</button>
          )}
          
          {/* Obstacle controls */}
          <button 
            onClick={() => {
              cleanupAllOperations();
              setPlacingObstacle(!placingObstacle);
            }}
            className={placingObstacle ? 'active' : ''}
          >
            {placingObstacle ? 'Cancel' : 'Place Obstacle'}
          </button>
          <button onClick={() => {
            cleanupAllOperations();
            clearObstacles();
          }}>Clear Obstacles</button>
          
          {alternativePaths.length > 1 && (
            <button onClick={() => setShowPathOptions(true)}>
              Show Path Options ({alternativePaths.length})
            </button>
          )}
          
          {/* Removed obstacle size input */}
        </div>
      </div>
      
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={17} 
        maxZoom={19}
        minZoom={15}
        zoomControl={false}
        maxBounds={[
          [10.897, 76.894], // Southwest corner
          [10.910, 76.905]  // Northeast corner
        ]}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        attributionControl={true}
        whenCreated={(map) => {
          // Add event listeners to ensure map stays within bounds
          map.on('drag', () => {
            const bounds = L.latLngBounds(
              [10.897, 76.894],
              [10.910, 76.905]
            );
            map.panInsideBounds(bounds, { animate: false });
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
        
        {/* Show paths */}
        {path.length > 0 && (
          <>
            {/* Show alternative paths first (underneath) */}
            {alternativePaths.length > 1 && alternativePaths.map((altPath, index) => {
              // Skip the currently selected path (will be shown with different style)
              if (index === selectedPathIndex) return null;
              
              // Generate unique path styling based on index
              const color = getPathColor(index);
              
              return (
                <Polyline
                  key={`alt-path-${index}`}
                  positions={altPath.path}
                  color={color}
                  weight={index === 0 ? 3 : 2} // Thicker line for first (shortest) alternative
                  opacity={0.7}
                  dashArray={index % 2 === 0 ? "5, 10" : "1, 10"} // Different dash patterns
                  className={`alternative-path-${index}`}
                />
              );
            })}
            
            {/* Main selected path - show on top */}
            <Polyline 
              positions={path} 
              color="#0078D7"
              weight={5} 
              opacity={1.0}
              dashArray={null} // Ensure it's a solid line with no dashes
              className={`selected-path`}
            />
            
            {/* Connect start marker to the closest point on path with dotted line */}
            {startMarker && startPathPoint && (
              <Polyline 
                positions={[
                  [startMarker.position.lat, startMarker.position.lng],
                  startPathPoint.point
                ]} 
                color="#0078D7" 
                weight={3} 
                dashArray="5, 10" 
              />
            )}
            
            {/* Connect end marker to the closest point on path with dotted line */}
            {endMarker && endPathPoint && (
              <Polyline 
                positions={[
                  [endMarker.position.lat, endMarker.position.lng],
                  endPathPoint.point
                ]} 
                color="#0078D7" 
                weight={3} 
                dashArray="5, 10" 
              />
            )}
          </>
        )}
        
        {/* Show obstacles */}
        {obstacles.map(obstacle => (
          <Circle 
            key={obstacle.id}
            center={obstacle.position} 
            radius={obstacle.radius}
            color="red"
            fillColor="red"
            fillOpacity={0.7}
            weight={2}
          />
        ))}
        
        {/* Show waypoints as markers */}
        {waypoints.map((waypoint, index) => (
          <Marker 
            key={`waypoint-${index}`}
            position={[waypoint.position.lat, waypoint.position.lng]} 
            title={`Waypoint ${index + 1}`}
            icon={createWaypointIcon(index)}
          >
          </Marker>
        ))}
        
        {/* Component to handle obstacle placement */}
        <ObstacleMarker 
          obstacles={obstacles} 
          setObstacles={setObstacles} 
          placingObstacle={placingObstacle}
          obstacleSizeMeters={OBSTACLE_SIZE_METERS}
        />
        
        {/* Show start marker */}
        {startMarker && (
          <Marker 
            position={[startMarker.position.lat, startMarker.position.lng]} 
            title="Start"
            icon={createStartIcon()}
          />
        )}
        
        {/* Show end marker */}
        {endMarker && (
          <Marker 
            position={[endMarker.position.lat, endMarker.position.lng]} 
            title="End"
            icon={createEndIcon()}
          />
        )}
        
        {/* Show current location only during simulation */}
        {simulationActive && (
          <>
            <Marker 
              position={currentLocation} 
              icon={createLocationIcon()}
              title="Current Position"
            />
            {movementTrail.length > 0 && (
              <Polyline
                positions={movementTrail}
                color="green"
                weight={3}
                dashArray="5, 10"
              />
            )}
          </>
        )}
        
        {/* Update map view when path changes */}
        <MapUpdater path={path} />
      </MapContainer>
      
      {/* Path options modal */}
      {showPathOptions && alternativePaths.length > 0 && (
        <div className="path-options-modal">
          <div className="path-options-content">
            <h2>Select a Path</h2>
            <div className="path-list">
              {alternativePaths.map((pathOption, index) => (
                <div 
                  key={index} 
                  className={`path-option ${selectedPathIndex === index ? 'selected' : ''}`}
                  onClick={() => switchToPath(index)}
                >
                  <h3>Path {index + 1}</h3>
                  <div className="path-stats">
                    <p>Distance: {(pathOption.distance / 1000).toFixed(2)} km</p>
                    <p>Time: {pathOption.time.toFixed(1)} min</p>
                    <p className={pathOption.hasObstacles ? 'warning' : 'good'}>
                      {pathOption.hasObstacles 
                        ? `Obstacles: ${pathOption.intersectionCount}` 
                        : 'No obstacles'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button className="close-button" onClick={() => setShowPathOptions(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Video feed */}
      <div className="video-feed">
        <img ref={videoRef} alt="Video feed" />
      </div>
      
      {/* Object detection status */}
      <div className="detection-status">
        <h3>Detected Objects: {objects.length}</h3>
        <ul>
          {objects.map((obj, index) => (
            <li key={index}>
              Class: {obj.class}, Confidence: {obj.confidence.toFixed(2)}
              {obj.is_obstacle && <strong> (Obstacle)</strong>}
            </li>
          ))}
        </ul>
        {obstacles.length > 0 && (
          <div>
            <h3>Manual Obstacles: {obstacles.length}</h3>
            <button onClick={clearObstacles}>Clear All</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 