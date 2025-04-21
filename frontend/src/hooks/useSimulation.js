import { useState, useRef, useEffect, useCallback } from 'react';
import { isNearObstacle } from '../utils/obstacleUtils';

const useSimulation = (path, obstacles, onObstacleDetected = null) => {
  const [simulationActive, setSimulationActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([0, 0]);
  const [movementTrail, setMovementTrail] = useState([]);
  const [simulationSpeed, setSimulationSpeed] = useState(3); // Reduced for smoother movement
  const [simulationIntervalMs, setSimulationIntervalMs] = useState(60); // Increased frequency for smoothness
  const [obstacleDetected, setObstacleDetected] = useState(false);
  const [obstacleLocation, setObstacleLocation] = useState(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  
  const simulationIntervalRef = useRef(null);

  // Cleanup function
  const cleanupAllOperations = useCallback(() => {
    // Clear any existing simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
      setSimulationActive(false);
    }
    
    // Reset state
    setMovementTrail([]);
    setObstacleDetected(false);
    setObstacleLocation(null);
  }, []);
  
  // Function to start simulation from a specific point on the path
  const startSimulationFromPoint = useCallback((startSegmentIndex, startProgressPercentage) => {
    if (!path || path.length < 2) {
      console.error("No valid path to simulate");
      return false;
    }
    
    console.log(`Starting simulation from segment ${startSegmentIndex} with progress ${startProgressPercentage}%, path length: ${path.length}`);
    
    setSimulationActive(true);
    setObstacleDetected(false);
    
    // Keep track of which segment we're on and our progress within it
    let currentSegmentIndex = startSegmentIndex;
    let progressPercentage = startProgressPercentage;
    
    // Store these values in state for potential rerouting
    setCurrentSegmentIndex(currentSegmentIndex);
    setCurrentProgress(progressPercentage);
    
    // Direction of movement - start with forward
    let isMovingForward = true;
    
    if (simulationIntervalRef.current) {
      console.log("Clearing existing interval before starting new one");
      clearInterval(simulationIntervalRef.current);
    }
    
    // Create a new interval for the simulation
    const simulationInterval = setInterval(() => {
      // This allows us to follow the new path after rerouting
      
      try {
        // Access the current path from state
        const currentPath = path;
        
        if (!currentPath || currentPath.length < 2) {
          console.error("Invalid path during simulation interval");
          clearInterval(simulationInterval);
          return;
        }
        
        // Calculate the current and next position based on path and progress
        let startPoint, endPoint;
        
        if (isMovingForward) {
          // Normal forward movement
          startPoint = currentPath[currentSegmentIndex];
          endPoint = currentPath[currentSegmentIndex + 1];
        } else {
          // Backward movement - reverse the points
          startPoint = currentPath[currentSegmentIndex + 1];
          endPoint = currentPath[currentSegmentIndex];
        }
        
        if (!startPoint || !endPoint) {
          console.error("Invalid path points in simulation");
          clearInterval(simulationInterval);
          return;
        }
        
        // Interpolate between start and end based on progress percentage
        const currentPosition = [
          startPoint[0] + (endPoint[0] - startPoint[0]) * (progressPercentage / 100),
          startPoint[1] + (endPoint[1] - startPoint[1]) * (progressPercentage / 100)
        ];
        
        // Update position on the map
        setCurrentLocation(currentPosition);
        
        // Store the current segment and progress for potential rerouting
        setCurrentSegmentIndex(currentSegmentIndex);
        setCurrentProgress(progressPercentage);
        
        // We don't need to track the movement trail anymore
        // since we're not displaying it
        
        // Check if we've encountered an obstacle
        if (isNearObstacle(currentPosition, obstacles, 3.0)) {
          console.log("Obstacle detected during simulation");
          
          // Store the obstacle location
          setObstacleLocation(currentPosition);
          setObstacleDetected(true);
          
          // Completely stop the simulation
          clearInterval(simulationInterval);
          setSimulationActive(false);
          
          // Call the callback if provided
          if (onObstacleDetected && typeof onObstacleDetected === 'function') {
            onObstacleDetected(currentPosition);
          }
          return;
        }
        
        // Advance progress for the next iteration
        progressPercentage += simulationSpeed;
        
        // Check if we've completed the current segment
        if (progressPercentage >= 100) {
          // Reset progress and move to the next segment
          progressPercentage = 0;
          
          if (isMovingForward) {
            // Moving forward - increment segment index
            currentSegmentIndex += 1;
            
            // Check if we've reached the end of the path
            if (currentSegmentIndex >= currentPath.length - 1) {
              console.log("Reached destination, ending simulation");
              clearInterval(simulationInterval);
              setSimulationActive(false);
              return;
            }
          } else {
            // Moving backward - decrement segment index
            currentSegmentIndex -= 1;
            
            // Check if we've reached the beginning of the path
            if (currentSegmentIndex < 0) {
              console.log("Reached beginning of path while moving backward, switching to forward");
              currentSegmentIndex = 0;
              isMovingForward = true;
            }
          }
        }
      } catch (error) {
        console.error("Error in simulation loop:", error);
        clearInterval(simulationInterval);
      }
    }, simulationIntervalMs);
    
    // Save the interval reference to clear it later
    simulationIntervalRef.current = simulationInterval;
    return true;
  }, [path, obstacles, simulationSpeed, simulationIntervalMs, onObstacleDetected]);
  
  // Function to simulate movement along the path with obstacle avoidance
  const simulateMovement = useCallback(() => {
    console.log("simulateMovement called");
    
    // First ensure we have a valid path
    if (!path || path.length < 2) {
      console.error("Cannot simulate: no valid path exists");
      return;
    }
    
    // Clear any existing simulation
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    
    // Reset simulation state
    setMovementTrail([]);
    setSimulationActive(true);
    setObstacleDetected(false);
    setObstacleLocation(null);
    
    try {
      // Start simulation directly with the current path without checking for obstacles beforehand
      console.log("Starting simulation on current path");
      const startPoint = path[0];
      setCurrentLocation(startPoint);
      
      // Start immediately instead of using setTimeout
      const success = startSimulationFromPoint(0, 0);
      if (!success) {
        console.error("Failed to start simulation");
        setSimulationActive(false);
      }
    } catch (error) {
      console.error("Error in simulation startup:", error);
      setSimulationActive(false);
    }
  }, [path, startSimulationFromPoint, setSimulationActive, setCurrentLocation]);
  
  // Resume simulation after rerouting
  const resumeSimulation = useCallback(() => {
    if (!obstacleDetected || !path || path.length < 2) {
      console.error("Cannot resume: no obstacle was detected or path is invalid");
      return;
    }
    
    console.log("Resuming simulation with new path");
    setObstacleDetected(false);
    setObstacleLocation(null);
    
    // Start simulation from the beginning of the new path
    startSimulationFromPoint(0, 0);
  }, [obstacleDetected, path, startSimulationFromPoint]);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);
  
  return {
    simulationActive,
    setSimulationActive,
    currentLocation,
    movementTrail,
    simulationSpeed,
    setSimulationSpeed,
    simulationIntervalMs,
    setSimulationIntervalMs,
    cleanupAllOperations,
    startSimulationFromPoint,
    simulateMovement,
    simulationIntervalRef,
    obstacleDetected,
    obstacleLocation,
    resumeSimulation
  };
};

export default useSimulation; 