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
  const videoFeedIntervalRef = useRef(null);
  
  // Start fetching video frames on component mount
  useEffect(() => {
    // Initialize video feed
    startVideoFeed();
    
    // Clean up on unmount
    return () => {
      stopVideoFeed();
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, []);
  
  // Function to start video feed without detection
  const startVideoFeed = () => {
    if (videoFeedIntervalRef.current) {
      clearInterval(videoFeedIntervalRef.current);
    }
    
    videoFeedIntervalRef.current = setInterval(async () => {
      try {
        // Only fetch video frame if detection is not running
        // (to avoid duplicate fetching when detection is active)
        if (!detectionRunning) {
          const frameSrc = await fetchVideoFrame();
          if (videoRef.current) {
            videoRef.current.src = frameSrc;
          }
        }
      } catch (error) {
        console.error('Error fetching video feed:', error);
      }
    }, 100);
  };
  
  // Function to stop video feed
  const stopVideoFeed = () => {
    if (videoFeedIntervalRef.current) {
      clearInterval(videoFeedIntervalRef.current);
      videoFeedIntervalRef.current = null;
    }
  };
  
  // Function to start detection
  const startDetection = async () => {
    try {
      // Start detection service
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
          
          // Process obstacles from detected objects
          processObstaclesFromDetection(detectedObjects);
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
  
  return {
    detectionRunning,
    objects,
    videoRef,
    startDetection,
    stopDetection
  };
};

export default useDetection; 