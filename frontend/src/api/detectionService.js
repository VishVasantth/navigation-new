import axios from 'axios';
import { DETECTION_URL } from '../config/constants';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Function to start detection
export const startDetection = async (options = {}) => {
  try {
    // Create request body with RTSP settings
    const requestBody = {
      // Respect explicit false; default to true if undefined
      use_rtsp: options.useRtsp !== undefined ? options.useRtsp : true,
      // Include RTSP URL only if provided
      rtsp_url: options.rtspUrl,
      // Camera ID for local camera usage
      camera_id: options.cameraId || 0
    };
    
    // Start detection service
    const response = await axios.post(`${DETECTION_URL}/start`, requestBody);
    
    if (response.data.status === 'success') {
      return true;
    } else {
      throw new Error(response.data.message || 'Unknown error starting detection');
    }
  } catch (error) {
    console.error('Error starting detection:', error);
    throw error;
  }
};

// Function to stop detection
export const stopDetection = async () => {
  try {
    const response = await axios.post(`${DETECTION_URL}/stop`);
    if (response.data.status === 'success') {
      return true;
    } else {
      throw new Error(response.data.message || 'Unknown error stopping detection');
    }
  } catch (error) {
    console.error('Error stopping detection:', error);
    throw error;
  }
};

// Function to fetch the current video frame
export const fetchVideoFrame = async () => {
  try {
    const response = await axios.get(`${DETECTION_URL}/frame`, {
      responseType: 'blob'
    });
    return URL.createObjectURL(response.data);
  } catch (error) {
    console.error('Error fetching video frame:', error);
    throw error;
  }
};

// Function to fetch detected objects
export const fetchDetectedObjects = async () => {
  try {
    const response = await axios.get(`${DETECTION_URL}/objects`);
    return response.data.objects || [];
  } catch (error) {
    console.error('Error fetching detected objects:', error);
    return [];
  }
};

export async function detect_frame(frame, setObstacles, currentLocation) {
  try {
    // Convert canvas to blob
    const response = await fetch(`${API_URL}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: frame,
        location: currentLocation // Pass current GPS location if available
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Process detected objects
    if (data.objects && data.objects.length > 0) {
      // If GPS location is available, use it for obstacle positions
      if (currentLocation) {
        data.objects.forEach(obj => {
          if (obj.class === 'obstacle' || obj.class === 'person' || obj.class === 'car') {
            // Create an obstacle at the current GPS location
            const newObstacle = {
              id: Date.now() + Math.random(), // Ensure unique ID
              position: currentLocation,
              radius: 5, // Default size in meters
              isDetected: true,
              detectionConfidence: obj.confidence,
              class: obj.class
            };
            
            // Add obstacle to state
            setObstacles(prev => {
              // Check if similar obstacle already exists at this location
              const exists = prev.some(existing => 
                Math.abs(existing.position[0] - currentLocation[0]) < 0.0001 &&
                Math.abs(existing.position[1] - currentLocation[1]) < 0.0001
              );
              
              if (!exists) {
                return [...prev, newObstacle];
              }
              return prev;
            });
          }
        });
      }
    }
    
    return data.objects || [];
  } catch (error) {
    console.error('Error detecting objects:', error);
    return [];
  }
}

export async function get_status() {
  try {
    const response = await fetch(`${API_URL}/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking detection service status:', error);
    return { status: 'error', message: error.message };
  }
} 