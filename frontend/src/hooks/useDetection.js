import { useState, useRef, useEffect, useCallback } from 'react';
import {
  startDetection as apiStartDetection,
  stopDetection as apiStopDetection,
  fetchVideoFrame,
  fetchDetectedObjects
} from '../api/detectionService';

const useDetection = (setObstacles) => {
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [objects, setObjects] = useState([]);
  const videoRef = useRef(null);
  const frameIntervalRef = useRef(null);
  
  // Initialize video feed with placeholder image when component mounts
  useEffect(() => {
    // Set a placeholder image
    if (videoRef.current) {
      // Using a colored background as placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '18px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('Camera Feed', canvas.width/2, canvas.height/2 - 10);
      ctx.fillText('(Detection not running)', canvas.width/2, canvas.height/2 + 20);
      
      videoRef.current.src = canvas.toDataURL();
    }
    
    // Try to fetch a single frame even if detection is not running
    const fetchInitialFrame = async () => {
      try {
        const frameSrc = await fetchVideoFrame();
        if (videoRef.current) {
          videoRef.current.src = frameSrc;
        }
      } catch (error) {
        // Initial frame fetch failed, using the placeholder
        console.log('Using placeholder image for video feed');
      }
    };
    
    fetchInitialFrame();
  }, []);
  
  // Function to start detection
  const startDetection = async () => {
    try {
      // Start detection service using RTSP stream by default
      await apiStartDetection();
      setDetectionRunning(true);
      
      // Start fetching video frames
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      
      frameIntervalRef.current = setInterval(async () => {
        try {
          // Fetch video frame
          const frameSrc = await fetchVideoFrame();
          if (videoRef.current) {
            videoRef.current.src = frameSrc;
          }
          
          // Fetch detected objects
          const detectedObjects = await fetchDetectedObjects();
          setObjects(detectedObjects);
          
          // NOTE: Obstacle placement now handled centrally in App.js, so skip here
          // processObstaclesFromDetection(detectedObjects);
        } catch (error) {
          console.error('Error fetching video frame:', error);
        }
      }, 100);
      
      return true;
    } catch (error) {
      console.error('Error starting detection:', error);
      alert('Error starting detection: ' + error.message);
      return false;
    }
  };
  
  // Function to stop detection
  const stopDetection = async () => {
    try {
      await apiStopDetection();
      setDetectionRunning(false);
      
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      
      // Display a static message when detection stops
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '18px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('Camera Feed', canvas.width/2, canvas.height/2 - 10);
        ctx.fillText('(Detection stopped)', canvas.width/2, canvas.height/2 + 20);
        
        videoRef.current.src = canvas.toDataURL();
      }
      
      return true;
    } catch (error) {
      console.error('Error stopping detection:', error);
      alert('Error stopping detection: ' + error.message);
      // Still cleanup even if API call fails
      setDetectionRunning(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return false;
    }
  };
  
  // Helper function to process obstacles from detection
  const processObstaclesFromDetection = useCallback((detectedObjects) => {
    if (!detectedObjects || detectedObjects.length === 0) return;
    
    // Filter objects that are obstacles and have valid positions
    const obstacleObjects = detectedObjects.filter(obj => 
      obj.is_obstacle === true && 
      obj.position && 
      obj.position.length === 2 &&
      obj.confidence > 0.5  // Only consider high-confidence detections
    );
    
    if (obstacleObjects.length === 0) return;
    
    // Add new obstacles
    setObstacles(prevObstacles => {
      const updatedObstacles = [...prevObstacles];
      
      obstacleObjects.forEach(obj => {
        // Check if this obstacle already exists (approximately same position)
        const position = obj.position;
        const existingObstacle = prevObstacles.find(existing => {
          // Check if positions are close (within ~5 meters)
          const latDiff = Math.abs(existing.position[0] - position[0]);
          const lonDiff = Math.abs(existing.position[1] - position[1]);
          return latDiff < 0.00005 && lonDiff < 0.00005; // Approximately 5 meters
        });
        
        // If this is a new obstacle, add it
        if (!existingObstacle) {
          console.log(`Adding new obstacle from detection: ${obj.class} at ${position}`);
          
          updatedObstacles.push({
            id: Date.now() + Math.random(), // Ensure unique ID
            position: position,
            radius: obj.radius || 5, // Use detected radius or default to 5m
            class: obj.class,
            confidence: obj.confidence,
            source: 'detection'
          });
        }
      });
      
      return updatedObstacles;
    });
  }, [setObstacles]);
  
  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, []);
  
  return {
    detectionRunning,
    objects,
    videoRef,
    startDetection,
    stopDetection
  };
};

export default useDetection; 