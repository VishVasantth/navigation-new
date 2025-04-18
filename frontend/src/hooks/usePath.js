import { useState, useCallback } from 'react';
import { 
  fetchGraphHopperRoute, 
  fetchGraphHopperFallbackRoute, 
  createDirectPath 
} from '../api/routingService';
import { findClosestPointOnPathWithIndex } from '../utils/pathUtils';

const usePath = (obstacles = []) => {
  const [path, setPath] = useState([]);
  const [alternativePaths, setAlternativePaths] = useState([]);
  const [showAllPaths, setShowAllPaths] = useState(true);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [startMarker, setStartMarker] = useState(null);
  const [endMarker, setEndMarker] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [route, setRoute] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState(null);
  const [startPathPoint, setStartPathPoint] = useState(null);
  const [endPathPoint, setEndPathPoint] = useState(null);

  // Helper function to generate waypoints
  const updateWaypoints = useCallback((pathCoordinates, intersections = []) => {
    if (!pathCoordinates || pathCoordinates.length < 2) return;
    
    const waypoints = [];
    
    // Add start point as first waypoint/node
    waypoints.push({
      position: { lat: pathCoordinates[0][0], lng: pathCoordinates[0][1] },
      label: 'S',
      name: 'Start Point',
      isNode: true
    });
    
    // Find points where there's a significant direction change (road turns/separations)
    const directionChangeThreshold = 20; // degrees
    
    for (let i = 1; i < pathCoordinates.length - 1; i++) {
      const prev = pathCoordinates[i-1];
      const current = pathCoordinates[i];
      const next = pathCoordinates[i+1];
      
      // Calculate vectors
      const vec1 = [current[0] - prev[0], current[1] - prev[1]];
      const vec2 = [next[0] - current[0], next[1] - current[1]];
      
      // Calculate magnitudes
      const mag1 = Math.sqrt(vec1[0]*vec1[0] + vec1[1]*vec1[1]);
      const mag2 = Math.sqrt(vec2[0]*vec2[0] + vec2[1]*vec2[1]);
      
      // Skip if any segment is too short (avoid division by zero)
      if (mag1 < 0.00001 || mag2 < 0.00001) continue;
      
      // Calculate dot product and angle
      const dotProduct = vec1[0]*vec2[0] + vec1[1]*vec2[1];
      const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct / (mag1 * mag2)))) * (180 / Math.PI);
      
      // If there's a significant direction change or the distance from the last waypoint is substantial
      if (angle > directionChangeThreshold || (waypoints.length > 0 && 
          i > 10 + waypoints[waypoints.length-1].index)) {
        
        waypoints.push({
          position: { lat: current[0], lng: current[1] },
          label: `${waypoints.length}`,
          name: `Node ${waypoints.length}`,
          isNode: true,
          index: i
        });
      }
    }
    
    // Add end point as last waypoint/node
    waypoints.push({
      position: { lat: pathCoordinates[pathCoordinates.length-1][0], lng: pathCoordinates[pathCoordinates.length-1][1] },
      label: 'E',
      name: 'End Point',
      isNode: true,
      index: pathCoordinates.length-1
    });
    
    // Add intersection nodes to waypoints
    if (intersections && intersections.length > 0) {
      // Find the closest segment on the path for each intersection
      intersections.forEach((intersection, idx) => {
        const { findClosestPointOnPathWithIndex } = require('../utils/pathUtils');
        const closestInfo = findClosestPointOnPathWithIndex(
          [intersection.position.lat, intersection.position.lng],
          pathCoordinates
        );
        
        // Only add if the intersection is close enough to the path
        if (closestInfo.distance < 0.0001) { // Approximately 10 meters
          waypoints.push({
            position: intersection.position, 
            label: `I${idx+1}`,
            name: `Intersection ${idx+1}`,
            isIntersection: true,
            segmentIndex: closestInfo.segmentIndex,
            index: closestInfo.segmentIndex
          });
        }
      });
    }
    
    // Sort waypoints by their index on the path for proper sequence
    waypoints.sort((a, b) => {
      if (!a.index && !b.index) return 0;
      if (!a.index) return 1;
      if (!b.index) return -1;
      return a.index - b.index;
    });
    
    // Re-label sequential nodes for clarity
    waypoints.forEach((waypoint, idx) => {
      if (!waypoint.isIntersection && waypoint.label !== 'S' && waypoint.label !== 'E') {
        waypoint.label = `${idx}`;
        waypoint.name = `Node ${idx}`;
      }
    });
    
    console.log(`Generated ${waypoints.length} waypoints for the path`);
    setWaypoints(waypoints);
  }, []);

  // Function to fall back to a direct path between points
  const fallbackToDirectPath = useCallback(async (start, end) => {
    try {
      console.log("Attempting to create a path using GraphHopper fallback method");
      
      // Try simplified GraphHopper route first
      const data = await fetchGraphHopperFallbackRoute(start, end);
      
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
        console.log("Setting fallback path with coordinates:", pathCoordinates);
        setPath(pathCoordinates);
        setAlternativePaths([pathCoordinates]);
        setRoutes([{
          path: pathCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
          distance: path.distance,
          time: path.time / 1000 / 60,
          coordinates: path.points.coordinates
        }]);
        
        // Add waypoints
        updateWaypoints(pathCoordinates);
        return;
      }
    } catch (error) {
      console.error("Fallback routing failed, creating a truly direct path:", error);
    }
    
    // If GraphHopper fails completely, create a simple direct path
    try {
      const directPathResult = createDirectPath(start, end);
      const directPath = directPathResult.path;
      
      // Set the route
      const routeData = {
        path: directPath.map(coord => ({ lat: coord[0], lng: coord[1] })),
        distance: directPathResult.distance,
        time: directPathResult.time,
        isDirectPath: true
      };
      
      setRoute(routeData);
      setRoutes([routeData]);
      
      // Set the path for visualization
      console.log("Setting truly direct path:", directPath);
      setPath(directPath);
      setAlternativePaths([directPath]);
      
      // Add waypoints
      updateWaypoints(directPath);
    } catch (error) {
      console.error("Failed to create direct path:", error);
      setError("Failed to create a valid path");
    }
  }, [updateWaypoints]);
  
  // Function to find path between two points using GraphHopper
  const findPath = useCallback(async (start, end) => {
    try {
      setRerouting(true);
      setError(null);
      
      // Reset route state
      setRoute(null);
      setRoutes([]);
      setWaypoints([]);
      setAlternativePaths([]);
      
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
      
      // Fetch route from GraphHopper
      const data = await fetchGraphHopperRoute(start, end);
      
      // Process the path - just take the first one by default
      if (data.paths && data.paths.length > 0) {
        // Store all alternative paths
        const allPaths = data.paths.map(path => {
          const pathCoordinates = path.points.coordinates.map(coord => [coord[1], coord[0]]);
          return {
            coordinates: pathCoordinates,
            routeData: {
              path: pathCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
              distance: path.distance,
              time: path.time / 1000 / 60,
              coordinates: path.points.coordinates
            }
          };
        });
        
        // Ensure unique routes by removing very similar paths
        const uniquePaths = filterSimilarPaths(allPaths);
        
        console.log(`Found ${uniquePaths.length} unique paths after filtering`);
        
        // Find intersections between alternative paths and create nodes
        const pathsForIntersection = uniquePaths.map(p => ({path: p.coordinates}));
        let intersections = [];
        
        // Import findPathIntersections if not already imported
        if (uniquePaths.length > 1) {
          try {
            const { findPathIntersections } = require('../utils/mapUtils');
            intersections = findPathIntersections(pathsForIntersection);
            console.log(`Found ${intersections.length} intersections between paths`);
          } catch (error) {
            console.error("Error finding path intersections:", error);
          }
        }
        
        // Set the primary path (first one)
        setPath(uniquePaths[0].coordinates);
        setRoute(uniquePaths[0].routeData);
        
        // Store all alternative paths
        setAlternativePaths(uniquePaths.map(p => p.coordinates));
        setRoutes(uniquePaths.map(p => p.routeData));
        setSelectedPathIndex(0);
        
        // Set showAllPaths to true to ensure all paths are visible
        setShowAllPaths(true);
        
        // Add waypoints for the primary path and include intersection nodes
        const primaryPath = uniquePaths[0].coordinates;
        updateWaypoints(primaryPath, intersections.map(intersection => ({
          position: { lat: intersection.position[0], lng: intersection.position[1] },
          isIntersection: true
        })));
        
        console.log(`Found ${uniquePaths.length} alternative paths`);
      } else {
        console.error("No valid paths returned from API");
        throw new Error("No valid paths returned");
      }
    } catch (error) {
      console.error("Error finding path:", error);
      // Fall back to a direct path
      await fallbackToDirectPath(start, end);
      setError(`Unable to find optimal path. Using direct route: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setRerouting(false);
    }
  }, [fallbackToDirectPath, updateWaypoints]);
  
  // Helper function to filter similar paths
  const filterSimilarPaths = (paths) => {
    if (paths.length <= 1) return paths;
    
    // First, simplify all paths to remove unnecessary protrusions
    const simplifiedPaths = paths.map(path => {
      return {
        ...path,
        coordinates: simplifyPath(path.coordinates),
        routeData: {
          ...path.routeData,
          path: simplifyPath(path.coordinates).map(coord => ({ lat: coord[0], lng: coord[1] }))
        }
      };
    });
    
    // Sort paths by distance (shortest first) before filtering
    simplifiedPaths.sort((a, b) => a.routeData.distance - b.routeData.distance);
    
    const uniquePaths = [simplifiedPaths[0]];
    
    // First pass: find truly different paths based on similarity threshold
    for (let i = 1; i < simplifiedPaths.length; i++) {
      const currentPath = simplifiedPaths[i];
      let isUnique = true;
      
      // Compare with already accepted unique paths
      for (const uniquePath of uniquePaths) {
        // Check if the paths have the same distance (indicates potential duplicate)
        const distanceDiff = Math.abs(currentPath.routeData.distance - uniquePath.routeData.distance);
        const isDistanceSimilar = distanceDiff < 10; // If within 10 meters, consider similar
        
        // Check path similarity using more samples for better accuracy
        const similarity = calculatePathSimilarityDetailed(currentPath.coordinates, uniquePath.coordinates);
        
        // If distance is very similar AND path points are similar, consider it a duplicate
        if ((isDistanceSimilar && similarity > 0.4) || similarity > 0.7) {
          isUnique = false;
          break;
        }
      }
      
      if (isUnique) {
        uniquePaths.push(currentPath);
      }
      
      // Stop once we have 3 unique paths
      if (uniquePaths.length >= 3) {
        break;
      }
    }
    
    // If we couldn't find 3 unique paths, add more paths even if somewhat similar
    if (uniquePaths.length < 3 && simplifiedPaths.length >= 3) {
      const additionalPaths = [];
      
      for (let i = 0; i < simplifiedPaths.length && uniquePaths.length + additionalPaths.length < 3; i++) {
        // Skip paths already in uniquePaths
        if (!uniquePaths.includes(simplifiedPaths[i])) {
          // Check if this path is significantly different from paths we've already decided to add
          let isUnique = true;
          
          for (const existingPath of [...uniquePaths, ...additionalPaths]) {
            // Check for distance similarity
            const distanceDiff = Math.abs(simplifiedPaths[i].routeData.distance - existingPath.routeData.distance);
            const isDistanceSimilar = distanceDiff < 10;
            
            // More detailed path similarity check
            const similarity = calculatePathSimilarityDetailed(simplifiedPaths[i].coordinates, existingPath.coordinates);
            
            // Stricter criteria to avoid duplicates
            if ((isDistanceSimilar && similarity > 0.3) || similarity > 0.6) {
              isUnique = false;
              break;
            }
          }
          
          if (isUnique || additionalPaths.length + uniquePaths.length < 3) {
            additionalPaths.push(simplifiedPaths[i]);
          }
        }
      }
      
      // Add additional paths to our unique paths
      uniquePaths.push(...additionalPaths);
    }
    
    // Ensure we never return more than 3 paths and they're unique
    return ensureUniquePaths(uniquePaths).slice(0, 3);
  };
  
  // A more detailed path similarity calculation that uses more sample points
  const calculatePathSimilarityDetailed = (path1, path2) => {
    // Increase the number of samples for more accurate similarity detection
    const samples = 8;
    let matchCount = 0;
    
    // Get path lengths
    const length1 = path1.length;
    const length2 = path2.length;
    
    if (length1 < 2 || length2 < 2) return 0;
    
    // Check start and end points
    const startDistance = calculateDistance(path1[0], path2[0]);
    const endDistance = calculateDistance(path1[length1-1], path2[length2-1]);
    
    // If start or end points are different, consider paths different
    if (startDistance > 0.0002 || endDistance > 0.0002) {
      return 0;
    }
    
    // Sample multiple points along the paths
    for (let i = 0; i < samples; i++) {
      const idx1 = Math.floor(length1 * i / samples);
      const idx2 = Math.floor(length2 * i / samples);
      
      if (idx1 >= length1 || idx2 >= length2) continue;
      
      const distance = calculateDistance(path1[idx1], path2[idx2]);
      
      // Points are considered similar if they're within ~20 meters
      if (distance < 0.0002) {
        matchCount++;
      }
    }
    
    // Return similarity ratio
    return matchCount / samples;
  };
  
  // Function to make final check for any remaining duplicate paths
  const ensureUniquePaths = (paths) => {
    if (paths.length <= 1) return paths;
    
    const result = [paths[0]];
    
    for (let i = 1; i < paths.length; i++) {
      let isDuplicate = false;
      
      for (const existingPath of result) {
        // Check if this might be a duplicate route by comparing distance and time
        const isSameDistance = Math.abs(paths[i].routeData.distance - existingPath.routeData.distance) < 5;
        const isSameTime = Math.abs(paths[i].routeData.time - existingPath.routeData.time) < 0.5;
        
        if (isSameDistance && isSameTime) {
          // Double-check with path similarity
          const similarity = calculatePathSimilarityDetailed(paths[i].coordinates, existingPath.coordinates);
          if (similarity > 0.6) {
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (!isDuplicate) {
        result.push(paths[i]);
      }
    }
    
    return result;
  };
  
  // Function to simplify a path by removing unnecessary protrusions
  const simplifyPath = (pathCoordinates) => {
    if (pathCoordinates.length <= 2) return pathCoordinates;
    
    // Douglas-Peucker algorithm with some modifications for route simplification
    const tolerance = 0.00002; // Approximately 2 meters tolerance
    const result = [pathCoordinates[0]]; // Start with the first point
    
    // Find points that represent significant direction changes
    for (let i = 1; i < pathCoordinates.length - 1; i++) {
      const prev = pathCoordinates[i-1];
      const current = pathCoordinates[i];
      const next = pathCoordinates[i+1];
      
      // Calculate vectors
      const v1 = [current[0] - prev[0], current[1] - prev[1]];
      const v2 = [next[0] - current[0], next[1] - current[1]];
      
      // Calculate magnitudes
      const mag1 = Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1]);
      const mag2 = Math.sqrt(v2[0]*v2[0] + v2[1]*v2[1]);
      
      // Skip if any segment is too short
      if (mag1 < tolerance || mag2 < tolerance) continue;
      
      // Calculate dot product and angle
      const dotProduct = v1[0]*v2[0] + v1[1]*v2[1];
      const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct / (mag1 * mag2)))) * (180 / Math.PI);
      
      // Keep points that represent significant turns
      if (angle > 30) {
        result.push(current);
      } else {
        // For smaller turns, check if this creates a detour
        // Calculate direct distance from prev to next
        const directDist = calculateDistance(prev, next);
        // Calculate detour distance (prev->current->next)
        const detourDist = calculateDistance(prev, current) + calculateDistance(current, next);
        
        // If the detour is significantly longer than the direct path, skip this point
        if (detourDist > directDist * 1.2) {
          continue;
        }
        
        // Otherwise, keep the point for a smoother path
        result.push(current);
      }
    }
    
    // Always include the last point
    result.push(pathCoordinates[pathCoordinates.length - 1]);
    
    // If we've simplified too aggressively (less than 20% of original path),
    // perform a second pass with more points preserved
    if (result.length < pathCoordinates.length * 0.2 && pathCoordinates.length > 10) {
      return simplifyPathLessAggressively(pathCoordinates);
    }
    
    return result;
  };
  
  // Less aggressive path simplification for case where we removed too many points
  const simplifyPathLessAggressively = (pathCoordinates) => {
    if (pathCoordinates.length <= 10) return pathCoordinates;
    
    const result = [pathCoordinates[0]]; // Start with the first point
    
    // Include points at regular intervals
    const step = Math.max(1, Math.floor(pathCoordinates.length / 10));
    for (let i = step; i < pathCoordinates.length - 1; i += step) {
      result.push(pathCoordinates[i]);
    }
    
    // Always include the last point
    result.push(pathCoordinates[pathCoordinates.length - 1]);
    
    return result;
  };
  
  // Calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    const latDiff = Math.abs(coord1[0] - coord2[0]);
    const lngDiff = Math.abs(coord1[1] - coord2[1]);
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  };
  
  // Function to update the closest points on the path to the markers
  const updateClosestPoints = useCallback(() => {
    if (!path || path.length < 2 || !startMarker || !endMarker) {
      setStartPathPoint(null);
      setEndPathPoint(null);
      return;
    }
    
    const startPos = [startMarker.position.lat, startMarker.position.lng];
    const endPos = [endMarker.position.lat, endMarker.position.lng];
    
    const closestStartResult = findClosestPointOnPathWithIndex(startPos, path);
    const closestEndResult = findClosestPointOnPathWithIndex(endPos, path);
    
    if (closestStartResult) {
      setStartPathPoint({
        point: closestStartResult.point,
        segmentIndex: closestStartResult.segmentIndex,
        distanceToPoint: closestStartResult.distanceToPoint
      });
    }
    
    if (closestEndResult) {
      setEndPathPoint({
        point: closestEndResult.point,
        segmentIndex: closestEndResult.segmentIndex,
        distanceToPoint: closestEndResult.distanceToPoint
      });
    }
  }, [path, startMarker, endMarker]);
  
  // Function to select a specific path
  const selectPath = useCallback((index) => {
    if (index >= 0 && index < alternativePaths.length) {
      setSelectedPathIndex(index);
      setPath(alternativePaths[index]);
      setRoute(routes[index]);
      updateWaypoints(alternativePaths[index]);
    }
  }, [alternativePaths, routes, updateWaypoints]);
  
  // Function to toggle showing all paths
  const toggleShowAllPaths = useCallback(() => {
    setShowAllPaths(prev => !prev);
  }, []);
  
  return {
    path,
    alternativePaths,
    showAllPaths,
    selectedPathIndex,
    startMarker,
    endMarker,
    waypoints,
    route,
    routes,
    rerouting,
    error,
    startPathPoint,
    endPathPoint,
    findPath,
    updateClosestPoints,
    selectPath,
    toggleShowAllPaths
  };
};

export default usePath; 