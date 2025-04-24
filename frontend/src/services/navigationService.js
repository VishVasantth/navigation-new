// Navigation instruction service

import { calculateHeading, calculateDistance } from '../utils/navigationUtils';

// Constants for navigation
export const INSTRUCTION_DISTANCE_THRESHOLD = 20; // meters
export const ANGLE_THRESHOLD = 30; // degrees

// Calculate bearing between two points (in degrees)
export const calculateBearing = (startLat, startLng, destLat, destLng) => {
  startLat = toRadians(startLat);
  startLng = toRadians(startLng);
  destLat = toRadians(destLat);
  destLng = toRadians(destLng);

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  return (bearing + 360) % 360;
};

// Helper function to convert degrees to radians
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Helper function to convert radians to degrees
const toDegrees = (radians) => {
  return radians * (180 / Math.PI);
};

// Calculate distance between two points using Haversine formula (in meters)
export const calculateDistanceHaversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lng2 - lng1);

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;

  return d; // in meters
};

// Get direction text based on bearing
export const getDirectionText = (bearing) => {
  if (bearing >= 337.5 || bearing < 22.5) return "north";
  if (bearing >= 22.5 && bearing < 67.5) return "northeast";
  if (bearing >= 67.5 && bearing < 112.5) return "east";
  if (bearing >= 112.5 && bearing < 157.5) return "southeast";
  if (bearing >= 157.5 && bearing < 202.5) return "south";
  if (bearing >= 202.5 && bearing < 247.5) return "southwest";
  if (bearing >= 247.5 && bearing < 292.5) return "west";
  if (bearing >= 292.5 && bearing < 337.5) return "northwest";
  return "forward"; // fallback
};

// Function to generate a readable instruction based on current location and next waypoint
export const generateNavigationInstruction = (currentPoint, nextPoint, afterNextPoint = null) => {
  if (!currentPoint || !nextPoint) {
    return "Continue on your route";
  }

  // Calculate distance to next point
  const distance = calculateDistance(currentPoint, nextPoint);
  
  // Distance format for human readability - round to nearest 5 meters for better consistency
  const roundedDistance = Math.round(distance / 5) * 5;
  const distanceText = `${roundedDistance} meters`;
  
  // If there's no point after next, it's the destination
  if (!afterNextPoint) {
    return `In ${distanceText}, you will reach your destination`;
  }
  
  // Calculate current heading
  const currentHeading = calculateHeading(currentPoint, nextPoint);
  
  // Calculate next turn heading
  const nextHeading = calculateHeading(nextPoint, afterNextPoint);
  
  // Calculate the turn angle
  let turnAngle = nextHeading - currentHeading;
  
  // Normalize the angle to be between -180 and 180
  if (turnAngle > 180) turnAngle -= 360;
  if (turnAngle < -180) turnAngle += 360;
  
  // Determine the turn direction and magnitude
  let turnInstruction = "continue straight";
  
  if (Math.abs(turnAngle) < 10) {
    turnInstruction = "continue straight";
  } else if (turnAngle >= 10 && turnAngle < 45) {
    turnInstruction = "turn slightly right";
  } else if (turnAngle >= 45 && turnAngle < 135) {
    turnInstruction = "turn right";
  } else if (turnAngle >= 135) {
    turnInstruction = "make a sharp right";
  } else if (turnAngle <= -10 && turnAngle > -45) {
    turnInstruction = "turn slightly left";
  } else if (turnAngle <= -45 && turnAngle > -135) {
    turnInstruction = "turn left";
  } else if (turnAngle <= -135) {
    turnInstruction = "make a sharp left";
  }
  
  return `In ${distanceText}, ${turnInstruction}`;
};

// Save user's navigation preferences
export const saveNavigationPreferences = (preferences) => {
  localStorage.setItem('navigationPreferences', JSON.stringify(preferences));
};

// Get user's saved navigation preferences
export const getNavigationPreferences = () => {
  const savedPrefs = localStorage.getItem('navigationPreferences');
  if (savedPrefs) {
    return JSON.parse(savedPrefs);
  }
  
  // Default preferences if none are saved
  return {
    voiceNavigation: true,
    hapticFeedback: false,
    visualAlerts: true
  };
}; 