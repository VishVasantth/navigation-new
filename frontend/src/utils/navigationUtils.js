import { calculateDistanceBetweenPoints } from './mapUtils';

// Helper function to calculate distance between two points
export const calculateDistance = (point1, point2) => {
  // Use the Haversine formula or simple Euclidean distance
  // For this implementation, using a simple distance calculation
  const lat1 = point1[0];
  const lon1 = point1[1];
  const lat2 = point2[0];
  const lon2 = point2[1];
  
  // Calculate distance using the existing function if available
  // or calculate using a simplified version
  return calculateDistanceBetweenPoints([lat1, lon1], [lat2, lon2]);
};

// Helper function to calculate heading between two points
export const calculateHeading = (point1, point2) => {
  // Reuse the bearing calculation for heading
  return calculateBearing(point1, point2);
};

// Helper function to calculate bearing between two points
export const calculateBearing = (start, end) => {
  const startLat = start[0] * Math.PI / 180;
  const startLng = start[1] * Math.PI / 180;
  const endLat = end[0] * Math.PI / 180;
  const endLng = end[1] * Math.PI / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// Helper function to get direction text
export const getDirectionText = (bearing) => {
  if (bearing >= 337.5 || bearing < 22.5) return "straight";
  if (bearing >= 22.5 && bearing < 67.5) return "slight right";
  if (bearing >= 67.5 && bearing < 112.5) return "right";
  if (bearing >= 112.5 && bearing < 157.5) return "sharp right";
  if (bearing >= 157.5 && bearing < 202.5) return "turn around";
  if (bearing >= 202.5 && bearing < 247.5) return "sharp left";
  if (bearing >= 247.5 && bearing < 292.5) return "left";
  if (bearing >= 292.5 && bearing < 337.5) return "slight left";
  return "straight";
};

// Helper function to generate navigation instruction
export const generateNavigationInstruction = (currentPoint, nextPoint, distance) => {
  const bearing = calculateBearing(currentPoint, nextPoint);
  const direction = getDirectionText(bearing);
  const roundedDistance = Math.round(distance);
  
  // Format the distance with proper units
  const distanceText = roundedDistance < 1000 
    ? `${roundedDistance} meters` 
    : `${(roundedDistance / 1000).toFixed(1)} kilometers`;
  
  // Create more natural, detailed instructions based on direction type
  switch(direction) {
    case "straight":
      return `Continue straight for ${distanceText}`;
      
    case "slight right":
      return `In ${distanceText}, bear slightly to the right`;
      
    case "slight left":
      return `In ${distanceText}, bear slightly to the left`;
      
    case "right":
      return `In ${distanceText}, make a right turn`;
      
    case "left":
      return `In ${distanceText}, make a left turn`;
      
    case "sharp right":
      return `In ${distanceText}, make a sharp right turn`;
      
    case "sharp left":
      return `In ${distanceText}, make a sharp left turn`;
      
    case "turn around":
      return `Please make a U-turn and go back for ${distanceText}`;
      
    default:
      return `Continue for ${distanceText}`;
  }
};

// Function to find path intersection nodes between two paths
export const findPathIntersectionNode = (currentPath, newPath) => {
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
  
  console.log(`Found ${intersections.length} intersection nodes between paths`);
  return intersections;
}; 