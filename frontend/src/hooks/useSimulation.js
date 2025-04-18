import { useState, useRef, useEffect, useCallback } from 'react';
import { isNearObstacle } from '../utils/obstacleUtils';

const useSimulation = (path, obstacles) => {
  const [simulationActive, setSimulationActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([0, 0]);
  const [movementTrail, setMovementTrail] = useState([]);
  const [simulationSpeed, setSimulationSpeed] = useState(5);
  const [simulationIntervalMs, setSimulationIntervalMs] = useState(100);
  
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
  }, []);
  
  // Function to start simulation from a specific point on the path
  const startSimulationFromPoint = useCallback((startSegmentIndex, startProgressPercentage) => {
    if (!path || path.length < 2) {
      console.error("No valid path to simulate");
      return false;
    }
    
    console.log(`Starting simulation from segment ${startSegmentIndex} with progress ${startProgressPercentage}%, path length: ${path.length}`);
    
    setSimulationActive(true);
    
    // Keep track of which segment we're on and our progress within it
    let currentSegmentIndex = startSegmentIndex;
    let progressPercentage = startProgressPercentage;
    
    // Direction of movement - start with forward
    let isMovingForward = true;
    
    if (simulationIntervalRef.current) {
      console.log("Clearing existing interval before starting new one");
      clearInterval(simulationIntervalRef.current);
    }
    
    // Create a new interval for the simulation
    const simulationInterval = setInterval(() => {
      // Always get the current path from state to ensure we're using the most up-to-date path
      // This allows us to follow the new path after rerouting
      
      if (!simulationActive) {
        console.log("Simulation paused, waiting for resume");
        return;
      }
      
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
        
        // Add to movement trail (but limit the size to avoid memory issues)
        setMovementTrail(prev => {
          const updated = [...prev, currentPosition];
          return updated.slice(-100); // Keep only the last 100 positions
        });
        
        // Check if we've encountered an obstacle
        if (isNearObstacle(currentPosition, obstacles, 3.0)) {
          console.log("Obstacle detected during simulation");
          // Stop the simulation when an obstacle is encountered
          clearInterval(simulationInterval);
          setSimulationActive(false);
          alert("Obstacle detected! Navigation halted.");
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
  }, [path, obstacles, simulationActive, simulationSpeed, simulationIntervalMs]);
  
  // Function to simulate movement along the path with obstacle avoidance
  const simulateMovement = useCallback(async () => {
    console.log("simulateMovement called");
    
    // First ensure we have a valid path
    if (!path || path.length < 2) {
      console.error("Cannot simulate: no valid path exists");
      alert('Please find a path first');
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
    
    try {
      // Start simulation directly with the current path without checking for obstacles beforehand
      console.log("Starting simulation on current path");
      const startPoint = path[0];
      setMovementTrail([startPoint]);
      setCurrentLocation(startPoint);
      
      setTimeout(() => {
        const success = startSimulationFromPoint(0, 0);
        if (!success) {
          console.error("Failed to start simulation");
          setSimulationActive(false);
          alert("Failed to start simulation. Please try finding a new path.");
        }
      }, 500);
    } catch (error) {
      console.error("Error in simulation startup:", error);
      setSimulationActive(false);
      alert(`Simulation error: ${error.message}`);
    }
  }, [path, startSimulationFromPoint]);
  
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
    simulationIntervalRef
  };
};

export default useSimulation; 