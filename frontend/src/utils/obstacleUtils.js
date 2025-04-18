import { calculateDistance, minDistanceFromPointToLineSegment } from './pathUtils';

// Check if a point is near any obstacle
export const isNearObstacle = (point, obstacles, threshold = 0.0002) => {
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
export const checkPathSegmentsAhead = (currentPos, path, currentSegmentIndex, lookAheadSegments, obstacles) => {
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

// Function to check if a line segment intersects with an obstacle
export const checkPathObstacleIntersection = (point1, point2, obstacles) => {
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
export const isPointInObstacle = (point, obstacle) => {
  const latDiff = point[0] - obstacle.position[0];
  const lngDiff = point[1] - obstacle.position[1];
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  
  // Convert lat/lng distance to approximate meters
  const distanceInMeters = distance * 111000;
  
  // Detect ANY obstacle regardless of size - use minimum 1 meter for very small obstacles
  return distanceInMeters < Math.max(1, obstacle.radius);
};

// Helper function to check if a path segment intersects with any obstacles
export const checkPathSegmentAgainstObstacles = (segmentStart, segmentEnd, obstacles) => {
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
    
    // Calculate segment length (not used in this implementation but useful for debugging)
    const segmentLengthMeters = calculateDistance(segmentStart, segmentEnd) * 111000;
    
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
export const createAvoidancePolygonsFromObstacles = (obstacles, scaleFactor = 1.0) => {
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