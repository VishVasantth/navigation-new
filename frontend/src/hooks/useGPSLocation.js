import { useState, useEffect, useCallback, useRef } from 'react';

const useGPSLocation = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationTrail, setLocationTrail] = useState([]);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  
  const watchIdRef = useRef(null);
  const trailMaxLength = 100; // Maximum number of trail points to store
  
  // Function to start GPS tracking
  const startTracking = useCallback(() => {
    setError(null);
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      console.warn("Geolocation not supported, using fallback location for testing");
      
      // Set a fallback location for testing (approximately Amrita campus)
      const fallbackLocation = [10.9026, 76.9006];
      setCurrentLocation(fallbackLocation);
      setAccuracy(20); // 20 meters accuracy for testing
      setIsWatching(true);
      
      // Simulate location updates for testing
      const simulationInterval = setInterval(() => {
        // Add small random movement for testing
        const lat = fallbackLocation[0] + (Math.random() - 0.5) * 0.0002;
        const lng = fallbackLocation[1] + (Math.random() - 0.5) * 0.0002;
        setCurrentLocation([lat, lng]);
        
        // Add to trail
        setLocationTrail(prevTrail => {
          const newTrail = [
            ...prevTrail, 
            { position: [lat, lng], timestamp: Date.now() }
          ];
          
          // Keep trail length limited
          if (newTrail.length > trailMaxLength) {
            return newTrail.slice(newTrail.length - trailMaxLength);
          }
          
          return newTrail;
        });
      }, 2000);
      
      // Store the interval ID for cleanup
      watchIdRef.current = simulationInterval;
      
      return true;
    }
    
    try {
      // Clear any existing watch
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      // Start watching position with high accuracy
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading, speed } = position.coords;
          
          // Format location as [lat, lng] to match path format
          const locationPoint = [latitude, longitude];
          
          setCurrentLocation(locationPoint);
          setAccuracy(accuracy);
          setHeading(heading);
          setSpeed(speed);
          
          // Add to trail with timestamp
          setLocationTrail(prevTrail => {
            const newTrail = [
              ...prevTrail, 
              { position: locationPoint, timestamp: Date.now() }
            ];
            
            // Keep trail length limited
            if (newTrail.length > trailMaxLength) {
              return newTrail.slice(newTrail.length - trailMaxLength);
            }
            
            return newTrail;
          });
        },
        (err) => {
          console.error("Error getting location:", err);
          setError(`Location error: ${err.message || 'Unknown error'}`);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
      
      setIsWatching(true);
      return true;
    } catch (err) {
      console.error("Error starting location tracking:", err);
      setError(`Failed to start location tracking: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, []);
  
  // Function to stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      // Clear the watch - handles both geolocation.clearWatch and clearInterval
      if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } else {
        clearInterval(watchIdRef.current);
      }
      
      watchIdRef.current = null;
      setIsWatching(false);
      return true;
    }
    return false;
  }, []);
  
  // Get a one-time location update
  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const locationPoint = [latitude, longitude];
          resolve({ position: locationPoint, accuracy });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  // Clear the trail
  const clearTrail = useCallback(() => {
    setLocationTrail([]);
  }, []);
  
  return {
    currentLocation,
    locationTrail,
    error,
    isWatching,
    accuracy,
    heading,
    speed,
    startTracking,
    stopTracking,
    getCurrentPosition,
    clearTrail
  };
};

export default useGPSLocation; 