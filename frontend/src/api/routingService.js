import axios from 'axios';
import { GRAPHHOPPER_API_KEY, OPENROUTE_SERVICE_URL, OPENROUTE_SERVICE_KEY } from '../config/constants';
import { createAvoidancePolygonsFromObstacles } from '../utils/obstacleUtils';

// Function to find path between two points using OpenRouteService
export const fetchOpenRouteServiceRoute = async (start, end) => {
  console.log(`Finding path from ${JSON.stringify(start)} to ${JSON.stringify(end)}...`);
  
  try {
    // Ensure start and end coordinates are valid numbers
    const startLat = parseFloat(start.lat);
    const startLng = parseFloat(start.lon || start.lng);
    const endLat = parseFloat(end.lat);
    const endLng = parseFloat(end.lon || end.lng);
    
    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      throw new Error("Invalid coordinates: coordinates must be numbers");
    }
    
    console.log("Requesting route from OpenRouteService...");
    
    // Get alternative routes from OpenRouteService
    const response = await axios.post(
      `${OPENROUTE_SERVICE_URL}/v2/directions/foot-walking/geojson`,
      {
        coordinates: [
          [startLng, startLat],
          [endLng, endLat]
        ],
        alternative_routes: {
          target_count: 3,
          weight_factor: 1.8
        },
        preference: "recommended",
        instructions: false,
        extra_info: ["waytype", "steepness"]
      },
      {
        headers: {
          'Authorization': OPENROUTE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.features || response.data.features.length === 0) {
      console.error("No routes found in OpenRouteService response");
      throw new Error("No routes found");
    }
    
    console.log(`Received ${response.data.features.length} routes from OpenRouteService`);
    
    // Process the response to create paths in the same format as our GraphHopper implementation
    let allPaths = [];
    
    // Process each feature/route
    for (const feature of response.data.features) {
      if (feature.geometry && feature.geometry.coordinates) {
        // Convert OpenRouteService coordinates to the format we need
        // ORS returns [lon, lat] but we need [lat, lon] for internal usage
        const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        // Add to paths array with distance and time information
        allPaths.push({
          distance: feature.properties.summary.distance,
          time: feature.properties.summary.duration * 1000, // Convert seconds to milliseconds
          points: {
            coordinates: feature.geometry.coordinates // Keep as [lon, lat] for compatibility
          },
          // Include extra information from OpenRouteService if available
          extras: feature.properties.extras || {},
          segments: feature.properties.segments || []
        });
      }
    }
    
    // If no paths found, create a default direct path
    if (allPaths.length === 0) {
      console.log("No paths found, creating a default path");
      const directPath = createDirectPath({ lat: startLat, lon: startLng }, { lat: endLat, lon: endLng });
      
      allPaths.push({
        distance: directPath.distance,
        time: directPath.time * 60 * 1000, // Convert to milliseconds
        points: {
          coordinates: directPath.path.map(coord => [coord[1], coord[0]]) // Swap for API format
        }
      });
    }
    
    // Return in the expected format
    const result = {
      paths: allPaths
    };
    
    // Sort paths by distance for consistency
    result.paths.sort((a, b) => a.distance - b.distance);
    
    console.log(`Returning ${result.paths.length} total paths`);
    return result;
  } catch (error) {
    console.error("Error fetching routes:", error);
    throw error;
  }
};

// Old GraphHopper implementation kept for reference and fallback
export const fetchGraphHopperRoute = async (start, end) => {
  // Use the new OpenRouteService function instead
  return fetchOpenRouteServiceRoute(start, end);
};

// Helper function to fetch alternative routes from GraphHopper
async function fetchAlternativeRoutes(startLat, startLng, endLat, endLng) {
    const url = `https://graphhopper.com/api/1/route?` +
      `point=${startLat},${startLng}&` +
      `point=${endLat},${endLng}&` +
      `vehicle=foot&` +
      `calc_points=true&` +
      `points_encoded=false&` +
      `algorithm=alternative_route&` +
      `alternative_route.max_paths=5&` + // Request up to 5 alternative paths
      `alternative_route.max_weight_factor=2.5&` + // Allow paths up to 2.5x the optimal weight
      `alternative_route.max_share_factor=0.6&` + // Reduce shared segments between alternatives for more diversity
      `ch.disable=true&` + // Disable contraction hierarchies for better alternative routes
      `key=${GRAPHHOPPER_API_KEY}`;
    
  console.log(`Requesting alternative routes from GraphHopper: ${url}`);
    
  const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`GraphHopper API error: ${response.status} ${response.statusText}`);
    }
    
  return await response.json();
}

// Function to generate a grid of waypoints around and along the path
function generateWaypointsGrid(pathCoordinates, startLat, startLng, endLat, endLng) {
  if (!pathCoordinates || pathCoordinates.length < 2) {
    return [];
  }
  
  const waypoints = [];
  
  // Calculate path length and direction
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  const pathDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  
  // Scale the offset based on the distance (larger distance = larger offset)
  const baseOffsetFactor = Math.min(0.0008, pathDistance * 0.1);
  
  // 1. Sample points along the path at regular intervals
  const pathSamples = Math.min(pathCoordinates.length, 4); // Limit to avoid too many API calls
  
  for (let i = 1; i < pathSamples; i++) {
    const index = Math.floor(pathCoordinates.length * i / pathSamples);
    if (index > 0 && index < pathCoordinates.length - 1) {
      const point = pathCoordinates[index];
      
      // Add the point itself
      waypoints.push({ lat: point[1], lng: point[0] });
      
      // Add offset points perpendicular to the path
      // Calculate perpendicular direction (90 degrees to path)
      const prevPoint = pathCoordinates[index - 1];
      const nextPoint = pathCoordinates[index + 1];
      
      const dx = nextPoint[0] - prevPoint[0];
      const dy = nextPoint[1] - prevPoint[1];
      
      // Perpendicular vector (normalize and scale)
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 0) {
        const perpX = -dy / length * baseOffsetFactor * 1.5;
        const perpY = dx / length * baseOffsetFactor * 1.5;
        
        // Points on both sides of the path
        waypoints.push({ 
          lat: point[1] + perpY, 
          lng: point[0] + perpX
        });
        
        waypoints.push({ 
          lat: point[1] - perpY, 
          lng: point[0] - perpX
        });
        
        // Points at 45-degree angles
        waypoints.push({ 
          lat: point[1] + perpY * 0.7 + (dy / length * baseOffsetFactor * 0.7), 
          lng: point[0] + perpX * 0.7 + (dx / length * baseOffsetFactor * 0.7)
        });
        
        waypoints.push({ 
          lat: point[1] - perpY * 0.7 + (dy / length * baseOffsetFactor * 0.7), 
          lng: point[0] - perpX * 0.7 + (dx / length * baseOffsetFactor * 0.7)
        });
      }
    }
  }
  
  // 2. Add static grid points around the middle of the path
  const midPointIndex = Math.floor(pathCoordinates.length / 2);
  const midPoint = pathCoordinates[midPointIndex];
  
  // Create a grid around the midpoint
  const gridSize = 2; // 5x5 grid
  for (let i = -gridSize; i <= gridSize; i++) {
    for (let j = -gridSize; j <= gridSize; j++) {
      // Skip the center point
      if (i !== 0 || j !== 0) {
        waypoints.push({
          lat: midPoint[1] + i * baseOffsetFactor,
          lng: midPoint[0] + j * baseOffsetFactor
        });
      }
    }
  }
  
  // Return unique waypoints
  return filterUniqueWaypoints(waypoints);
}

// Filter out waypoints that are too close to each other
function filterUniqueWaypoints(waypoints) {
  if (waypoints.length <= 1) return waypoints;
  
  const uniqueWaypoints = [waypoints[0]];
  const minDistance = 0.0001; // Minimum distance between waypoints
  
  for (let i = 1; i < waypoints.length; i++) {
    let isUnique = true;
    
    for (const uniqueWaypoint of uniqueWaypoints) {
      const latDiff = Math.abs(waypoints[i].lat - uniqueWaypoint.lat);
      const lngDiff = Math.abs(waypoints[i].lng - uniqueWaypoint.lng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
      
      if (distance < minDistance) {
        isUnique = false;
        break;
      }
    }
    
    if (isUnique) {
      uniqueWaypoints.push(waypoints[i]);
    }
  }
  
  return uniqueWaypoints;
}

// Helper function to get a route via two waypoints
async function getRouteViaTwoWaypoints(startLat, startLng, endLat, endLng, waypoint1Lat, waypoint1Lng, waypoint2Lat, waypoint2Lng) {
  try {
    const url = `https://graphhopper.com/api/1/route?` +
        `point=${startLat},${startLng}&` +
      `point=${waypoint1Lat},${waypoint1Lng}&` +
      `point=${waypoint2Lat},${waypoint2Lng}&` +
        `point=${endLat},${endLng}&` +
        `vehicle=foot&` +
        `calc_points=true&` +
        `points_encoded=false&` +
        `key=${GRAPHHOPPER_API_KEY}`;
      
    const response = await fetch(url);
      
      if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.paths && data.paths.length > 0) {
      return data.paths[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error getting route via two waypoints:", error);
    return null;
  }
}

// Helper function to get a direct route between two points
async function getDirectRoute(startLat, startLng, endLat, endLng) {
  try {
    const url = `https://graphhopper.com/api/1/route?` +
      `point=${startLat},${startLng}&` +
      `point=${endLat},${endLng}&` +
      `vehicle=foot&` +
      `calc_points=true&` +
      `points_encoded=false&` +
      `key=${GRAPHHOPPER_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.paths && data.paths.length > 0) {
      return data.paths[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error getting direct route:", error);
    return null;
  }
}

// Helper function to get a route via a waypoint
async function getRouteViaWaypoint(startLat, startLng, endLat, endLng, waypointLat, waypointLng) {
  try {
    const url = `https://graphhopper.com/api/1/route?` +
      `point=${startLat},${startLng}&` +
      `point=${waypointLat},${waypointLng}&` +
      `point=${endLat},${endLng}&` +
      `vehicle=foot&` +
      `calc_points=true&` +
      `points_encoded=false&` +
      `key=${GRAPHHOPPER_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data.paths && data.paths.length > 0) {
      return data.paths[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error getting route via waypoint:", error);
    return null;
  }
}

// Function to create a direct path between two points when routing fails
export const fetchOpenRouteServiceFallbackRoute = async (start, end) => {
  try {
    console.log("Attempting fallback route with OpenRouteService");
    
    // Try direct route with OpenRouteService
    const startLat = parseFloat(start.lat);
    const startLng = parseFloat(start.lon || start.lng);
    const endLat = parseFloat(end.lat);
    const endLng = parseFloat(end.lon || end.lng);
    
    const response = await axios.post(
      `${OPENROUTE_SERVICE_URL}/v2/directions/foot-walking/geojson`,
      {
        coordinates: [
          [startLng, startLat],
          [endLng, endLat]
        ],
        preference: "shortest", // Use shortest path for fallback
        instructions: false
      },
      {
        headers: {
          'Authorization': OPENROUTE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.features && response.data.features.length > 0) {
      // Convert to the expected format
      const feature = response.data.features[0];
      return {
        paths: [{
          distance: feature.properties.summary.distance,
          time: feature.properties.summary.duration * 1000, // Convert to milliseconds
          points: {
            coordinates: feature.geometry.coordinates // Already in [lon, lat] format
          }
        }]
      };
    } else {
      throw new Error("No paths found in fallback route");
    }
  } catch (error) {
    console.error("Fallback routing failed:", error);
    
    // Fallback to the original GraphHopper if needed
    if (process.env.NODE_ENV === 'development') {
      try {
        return fetchGraphHopperFallbackRoute(start, end);
      } catch (ghError) {
        console.error("GraphHopper fallback also failed:", ghError);
      }
    }
    
    // Create a truly direct path
    const directPath = createDirectPath(start, end);
    return {
      paths: [{
        distance: directPath.distance,
        time: directPath.time * 60 * 1000,
        points: {
          coordinates: directPath.path.map(coord => [coord[1], coord[0]])
        }
      }]
    };
  }
};

// Update the old fallback function to use the new implementation
export const fetchGraphHopperFallbackRoute = async (start, end) => {
  return fetchOpenRouteServiceFallbackRoute(start, end);
};

// Function to create a truly direct path when all routing fails
export const createDirectPath = (start, end) => {
  console.log("Creating direct point-to-point path with:", { start, end });
  
  // Validate inputs to prevent errors
  if (!start || !end) {
    console.error("Invalid inputs to createDirectPath:", { start, end });
    throw new Error("Invalid inputs to createDirectPath");
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
    [startPoint.lat, startPoint.lng],
    [
      startPoint.lat + (endPoint.lat - startPoint.lat) * 0.25,
      startPoint.lng + (endPoint.lng - startPoint.lng) * 0.25
    ],
    [
      startPoint.lat + (endPoint.lat - startPoint.lat) * 0.5,
      startPoint.lng + (endPoint.lng - startPoint.lng) * 0.5
    ],
    [
      startPoint.lat + (endPoint.lat - startPoint.lat) * 0.75,
      startPoint.lng + (endPoint.lng - startPoint.lng) * 0.75
    ],
    [endPoint.lat, endPoint.lng]
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
  
  return {
    path: pathCoordinates,
    distance: distance,
    time: estimatedTime,
    isDirectPath: true
  };
};

// Function to find a route avoiding obstacles using OpenRouteService
export const findRouteAvoidingObstacles = async (start, end, obstacles) => {
  try {
    // Request new route from OpenRouteService
    const response = await axios.get(`${OPENROUTE_SERVICE_URL}/v2/directions/foot-walking`, {
      params: {
        api_key: OPENROUTE_SERVICE_KEY,
        start: `${start[1]},${start[0]}`,
        end: `${end[1]},${end[0]}`,
        alternatives: true,
        options: JSON.stringify({ 
          avoid_features: ["steps", "fords"],
          avoid_polygons: createAvoidancePolygonsFromObstacles(obstacles, 2.0)
        })
      }
    });
    
    if (response.data && response.data.features && response.data.features.length > 0) {
      return response.data;
    }
    
    // Try with a more aggressive avoidance radius if no routes found
    const fallbackResponse = await axios.get(`${OPENROUTE_SERVICE_URL}/v2/directions/foot-walking`, {
      params: {
        api_key: OPENROUTE_SERVICE_KEY,
        start: `${start[1]},${start[0]}`,
        end: `${end[1]},${end[0]}`,
        options: JSON.stringify({ 
          avoid_features: ["steps", "fords"],
          avoid_polygons: createAvoidancePolygonsFromObstacles(obstacles, 3.0)
        })
      }
    });
    
    if (fallbackResponse.data && fallbackResponse.data.features && fallbackResponse.data.features.length > 0) {
      return fallbackResponse.data;
    }
    
    throw new Error("No viable routes found");
  } catch (error) {
    console.error("Error finding route avoiding obstacles:", error);
    throw error;
  }
}; 