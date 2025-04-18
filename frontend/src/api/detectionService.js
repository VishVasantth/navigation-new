import axios from 'axios';
import { DETECTION_URL } from '../config/constants';

// Function to start detection
export const startDetection = async (options = {}) => {
  try {
    // Create request body with RTSP settings
    const requestBody = {
      use_rtsp: options.useRtsp || true, // Default to RTSP
      rtsp_url: options.rtspUrl || undefined, // Optional custom RTSP URL
      camera_id: options.cameraId || 0 // Used if use_rtsp is false
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