import L from 'leaflet';
import { PATH_COLORS } from '../config/constants';

// Function to calculate distance between two points using Haversine formula (in meters)
export const calculateDistanceBetweenPoints = (point1, point2) => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const deltaLat = (point2[0] - point1[0]) * Math.PI / 180;
  const deltaLon = (point2[1] - point1[1]) * Math.PI / 180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance; // in meters
};

// Function to get a color for different paths
export const getPathColor = (index) => {
  // Use index as is if within range, or cycle through colors for larger indices
  return PATH_COLORS[index % PATH_COLORS.length];
};

// Define custom icons for markers
export const createLocationIcon = () => {
  return L.divIcon({
    className: 'current-location-marker',
    html: `<div class="pulse"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

export const createStartIcon = () => {
  return L.divIcon({
    className: 'start-marker',
    html: `<div class="start-icon">A</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

export const createEndIcon = () => {
  return L.divIcon({
    className: 'end-marker',
    html: `<div class="end-icon">B</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

export const createWaypointIcon = (label, options = {}) => {
  const isIntersection = options.isIntersection || false;
  const isNode = options.isNode || false;
  
  // Different colors for different types of waypoints
  let bgColor = '#3388FF'; // default
  let textColor = '#FFFFFF';
  let size = 24;
  
  if (isIntersection) {
    bgColor = '#FF5500'; // Orange for intersections
    size = 28;
  } else if (isNode) {
    bgColor = '#4CBB17'; // Green for road nodes/separations
    size = 26;
  }
  
  // Special styling for start/end
  if (label === 'S' || label === 'E') {
    bgColor = '#FF0000'; // Red for start/end
    size = 30;
  }

  return L.divIcon({
    className: 'waypoint-marker',
    html: `<div class="waypoint-icon" style="background-color: ${bgColor}; color: ${textColor};">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

export const createObstacleWaypointIcon = () => {
  return L.divIcon({
    className: 'obstacle-waypoint-marker',
    html: `<div class="obstacle-icon">!</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Function to find intersections between paths and create nodes
export const findPathIntersections = (paths) => {
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
  
  // Also detect road separations within each path
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i].path;
    if (path.length < 3) continue;
    
    // Look for significant direction changes
    const directionChangeThreshold = 30; // degrees
    
    for (let j = 1; j < path.length - 1; j++) {
      const prev = path[j-1];
      const current = path[j];
      const next = path[j+1];
      
      // Calculate vectors
      const vec1 = [current[0] - prev[0], current[1] - prev[1]];
      const vec2 = [next[0] - current[0], next[1] - current[1]];
      
      // Calculate magnitudes
      const mag1 = Math.sqrt(vec1[0]*vec1[0] + vec1[1]*vec1[1]);
      const mag2 = Math.sqrt(vec2[0]*vec2[0] + vec2[1]*vec2[1]);
      
      // Skip if any segment is too short
      if (mag1 < 0.00001 || mag2 < 0.00001) continue;
      
      // Calculate dot product and angle
      const dotProduct = vec1[0]*vec2[0] + vec1[1]*vec2[1];
      const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct / (mag1 * mag2)))) * (180 / Math.PI);
      
      // If there's a significant direction change
      if (angle > directionChangeThreshold) {
        // Create a node at this point
        const node = {
          position: [current[0], current[1]],
          pathIndices: [i],
          segmentIndices: [j],
          progress: [0],
          isSeparation: true
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
      }
    }
  }
  
  console.log(`Found ${intersections.length} intersection nodes between paths`);
  return intersections;
}; 