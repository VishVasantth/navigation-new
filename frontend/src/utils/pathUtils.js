// Functions related to path calculations and manipulations

// Function to find the closest point on a path to a given point
export const findClosestPointOnPath = (point, path) => {
  const result = findClosestPointOnPathWithIndex(point, path);
  return result.point;
};

// Function to find the closest point on a path to a given point, returning segment index and progress
export const findClosestPointOnPathWithIndex = (point, pathPoints) => {
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
export const findClosestPointOnSegment = (point, segmentStart, segmentEnd) => {
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
export const calculateDistance = (point1, point2) => {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate minimum distance from a point to a line segment
export const minDistanceFromPointToLineSegment = (point, lineStart, lineEnd) => {
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

// Helper to calculate distance between two points in meters using Haversine formula
export const calculateDistanceBetweenPoints = (point1, point2) => {
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