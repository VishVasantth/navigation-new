import { useState, useRef, useEffect, useCallback } from 'react';
import { isNearObstacle } from '../utils/obstacleUtils';
import { generateNavigationInstruction } from '../services/navigationService';
import { speakInstruction, getVoicePreference } from '../services/speechService';
import { calculateDistanceBetweenPoints } from '../utils/mapUtils';

const useSimulation = (path, obstacles, onObstacleDetected = null) => {
  const [simulationActive, setSimulationActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([0, 0]);
  const [movementTrail, setMovementTrail] = useState([]);
  const [simulationSpeed, setSimulationSpeed] = useState(1.5); // Reduced from 3 to 1.5 for slower movement
  const [simulationIntervalMs, setSimulationIntervalMs] = useState(100); // Increased from 60 to 100 for smoother, slower animation
  const [obstacleDetected, setObstacleDetected] = useState(false);
  const [obstacleLocation, setObstacleLocation] = useState(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState("");
  const [instructionHistory, setInstructionHistory] = useState([]); // Array to store upcoming instructions
  
  const simulationIntervalRef = useRef(null);
  const lastInstructionTimeRef = useRef(0);
  const navigationThresholdRef = useRef(30); // meters threshold for new instruction
  const lastDistanceUpdateRef = useRef(0); // Track last distance update for incremental updates
  const distanceUpdateIntervalRef = useRef(50); // Update distance display every 50 meters

  // Function to generate instructions for the entire path
  const generateFullPathInstructions = useCallback((path) => {
    if (!path || path.length < 2) return [];
    
    const instructions = [];
    
    // Generate an instruction for each segment of the path
    for (let i = 0; i < path.length - 1; i++) {
      const currentPoint = path[i];
      const nextPoint = path[i + 1];
      const afterNextPoint = i + 2 < path.length ? path[i + 2] : null;
      
      const instruction = generateNavigationInstruction(currentPoint, nextPoint, afterNextPoint);
      instructions.push({
        text: instruction,
        segmentIndex: i,
        completed: false
      });
    }
    
    // Add final destination instruction
    instructions.push({
      text: "You have reached your destination",
      segmentIndex: path.length - 1,
      completed: false
    });
    
    return instructions;
  }, []);

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
    setCurrentInstruction("");
    setInstructionHistory([]);
    
    // Reset distance update tracker
    lastDistanceUpdateRef.current = 0;
  }, []);
  
  // Function to provide navigation instructions at key points
  const provideNavigationInstruction = useCallback((currentPosition, segmentIndex, path) => {
    // Skip if no voice preferences but still generate the instruction text for display
    const voiceEnabled = getVoicePreference();
    
    // Check if we have enough points to generate an instruction
    if (!path || path.length < segmentIndex + 2) {
      if (path && path.length > 0 && segmentIndex >= path.length - 1) {
        // We've reached the destination
        const finalInstruction = "You have reached your destination";
        setCurrentInstruction(finalInstruction);
        
        // Update instruction history - mark all as completed
        setInstructionHistory(prev => 
          prev.map(instruction => ({
            ...instruction,
            completed: true
          }))
        );
        
        if (voiceEnabled) {
          speakInstruction(finalInstruction);
        }
      }
      return;
    }
    
    // For voice, only give instructions at reasonable intervals to avoid too much audio
    const now = Date.now();
    const shouldSpeak = voiceEnabled && (now - lastInstructionTimeRef.current >= 5000); // 5 second minimum between spoken instructions
    
    // Get current and next points for navigation
    const currentPoint = currentPosition;
    const nextPoint = path[segmentIndex + 1];
    
    // Get the point after next if available for turn instructions
    const afterNextPoint = segmentIndex + 2 < path.length ? path[segmentIndex + 2] : null;
    
    // Generate the instruction text
    const instruction = generateNavigationInstruction(currentPoint, nextPoint, afterNextPoint);
    
    // Update the current instruction state
    setCurrentInstruction(instruction);
    
    // Update instruction history - mark completed instructions and filter upcoming
    setInstructionHistory(prev => {
      // First mark current segment as completed
      const updated = prev.map(item => ({
        ...item,
        completed: item.segmentIndex <= segmentIndex
      }));
      
      // Then filter to only show upcoming (not completed) instructions
      return updated.filter(item => !item.completed);
    });
    
    // Speak the instruction if voice is enabled and time threshold is met
    if (shouldSpeak) {
      speakInstruction(instruction);
      lastInstructionTimeRef.current = now;
    }
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
    
    // Remove initial instruction - instructions will be provided by the navigation logic
    // instead of showing a generic starting message
    
    // Keep track of which segment we're on and our progress within it
    let currentSegmentIndex = startSegmentIndex;
    let progressPercentage = startProgressPercentage;
    
    // Store these values in state for potential rerouting
    setCurrentSegmentIndex(currentSegmentIndex);
    setCurrentProgress(progressPercentage);
    
    // Direction of movement - start with forward
    let isMovingForward = true;
    
    // Track the last segment type to detect completed turns
    let lastSegmentType = 'straight';
    let turnJustCompleted = false;
    
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
        
        // Calculate distance to next waypoint (if applicable)
        if (currentSegmentIndex + 1 < currentPath.length) {
          // For the next waypoint (usually an intersection or turn)
          const nextWaypoint = currentPath[currentSegmentIndex + 1];
          const distanceToNextPoint = calculateDistanceBetweenPoints(
            [currentPosition[0], currentPosition[1]],
            [nextWaypoint[0], nextWaypoint[1]]
          );
          
          // For the next instruction point (can be further along the path)
          let instructionTarget = null;
          let nextInstructionSegment = currentSegmentIndex + 1;
          
          // Find the next point where an actual turn or action is needed
          while (nextInstructionSegment + 1 < currentPath.length) {
            const pt1 = currentPath[nextInstructionSegment - 1];
            const pt2 = currentPath[nextInstructionSegment];
            const pt3 = currentPath[nextInstructionSegment + 1];
            
            // Skip if points are not valid
            if (!pt1 || !pt2 || !pt3) break;
            
            // Calculate bearings to detect turns
            const bearing1 = Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]) * 180 / Math.PI;
            const bearing2 = Math.atan2(pt3[1] - pt2[1], pt3[0] - pt2[0]) * 180 / Math.PI;
            
            // Calculate angle change
            const angleDiff = Math.abs(((bearing2 - bearing1 + 540) % 360) - 180);
            
            // If significant turn detected, use this as instruction point
            if (angleDiff > 20) {
              instructionTarget = pt2;
              break;
            }
            
            nextInstructionSegment++;
          }
          
          // If no instruction target found, use the next waypoint
          if (!instructionTarget) {
            instructionTarget = nextWaypoint;
          }
          
          // Calculate distance to the instruction target
          const distanceToInstructionTarget = calculateDistanceBetweenPoints(
            [currentPosition[0], currentPosition[1]],
            instructionTarget
          );
          
          // Round distance to nearest multiple of distance update interval
          const roundedDistance = Math.ceil(distanceToInstructionTarget / distanceUpdateIntervalRef.current) * 
                                 distanceUpdateIntervalRef.current;
          
          // Only update if distance has changed by at least the update interval
          if (Math.abs(roundedDistance - lastDistanceUpdateRef.current) >= distanceUpdateIntervalRef.current) {
            lastDistanceUpdateRef.current = roundedDistance;
            
            // Determine if we're approaching the next instruction point
            if (distanceToNextPoint < navigationThresholdRef.current) {
              // Close to the next waypoint, provide the next instruction
              provideNavigationInstruction(currentPosition, currentSegmentIndex, currentPath);
            } else {
              // Update the existing instruction with new distance
              // Get current and next points for navigation
              const currentPoint = currentPosition;
              const nextPoint = instructionTarget;
              
              // Get the point after next if available for turn instructions
              const afterNextPoint = (nextInstructionSegment + 1 < currentPath.length) 
                                  ? currentPath[nextInstructionSegment + 1] 
                                  : null;
              
              // Generate the instruction text with updated distance
              const instruction = generateNavigationInstruction(currentPoint, nextPoint, afterNextPoint);
              
              // Update the current instruction state
              setCurrentInstruction(instruction);
              
              // Speak the updated distance if voice is enabled and it's been a while since last announcement
              const now = Date.now();
              const voiceEnabled = getVoicePreference();
              
              // Only speak updates every 10 seconds if not at a critical distance
              if (voiceEnabled && 
                  (now - lastInstructionTimeRef.current >= 10000) && 
                  roundedDistance > 100 && 
                  roundedDistance % 100 === 0) {
                speakInstruction(instruction);
                lastInstructionTimeRef.current = now;
              }
              // Speak more frequently when getting closer
              else if (voiceEnabled && 
                      (now - lastInstructionTimeRef.current >= 5000) && 
                      roundedDistance <= 100) {
                speakInstruction(instruction);
                lastInstructionTimeRef.current = now;
              }
            }
          }
        } else {
          // Approaching destination
          provideNavigationInstruction(currentPosition, currentSegmentIndex, currentPath);
        }
        
        // Check if we've encountered an obstacle
        if (isNearObstacle(currentPosition, obstacles, 3.0)) {
          console.log("Obstacle detected during simulation");
          
          // Store the obstacle location
          setObstacleLocation(currentPosition);
          setObstacleDetected(true);
          
          // Completely stop the simulation
          clearInterval(simulationInterval);
          setSimulationActive(false);
          
          // Provide a voice notification about the obstacle
          if (getVoicePreference()) {
            const obstacleInstruction = "Obstacle detected ahead! Navigation halted.";
            setCurrentInstruction(obstacleInstruction);
            speakInstruction(obstacleInstruction);
          }
          
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
          
          // Determine if this was a turn segment
          if (currentSegmentIndex + 1 < currentPath.length) {
            // Check if this segment was a turn
            const currentSegment = {
              from: currentPath[Math.max(0, currentSegmentIndex - 1)],
              via: currentPath[currentSegmentIndex],
              to: currentPath[currentSegmentIndex + 1]
            };
            
            // Calculate bearings and angle change to determine if this was a turn
            const prevBearing = Math.atan2(
              currentSegment.via[1] - currentSegment.from[1],
              currentSegment.via[0] - currentSegment.from[0]
            ) * 180 / Math.PI;
            
            const nextBearing = Math.atan2(
              currentSegment.to[1] - currentSegment.via[1],
              currentSegment.to[0] - currentSegment.via[0]
            ) * 180 / Math.PI;
            
            // Calculate angle difference (normalized to -180 to 180)
            let angleDiff = ((nextBearing - prevBearing + 540) % 360) - 180;
            if (angleDiff < -180) angleDiff += 360;
            
            // Determine if the segment was a significant turn
            const currentSegmentType = Math.abs(angleDiff) > 20 ? 
              (angleDiff > 0 ? 'right' : 'left') : 'straight';
            
            // Detect if we just completed a turn
            turnJustCompleted = (lastSegmentType !== 'straight' && 
                                 currentSegmentType === 'straight');
            
            // Update last segment type for next iteration
            lastSegmentType = currentSegmentType;
          }
          
          if (isMovingForward) {
            // Moving forward - increment segment index
            currentSegmentIndex += 1;
            
            // Check if we've reached the end of the path
            if (currentSegmentIndex >= currentPath.length - 1) {
              console.log("Reached destination, ending simulation");
              clearInterval(simulationInterval);
              setSimulationActive(false);
              
              // Final destination announcement
              if (getVoicePreference()) {
                const finalInstruction = "You have reached your destination.";
                setCurrentInstruction(finalInstruction);
                speakInstruction(finalInstruction);
              }
              return;
            }
            
            // If we just completed a turn, announce the next direction
            if (turnJustCompleted && currentSegmentIndex + 1 < currentPath.length) {
              const voiceEnabled = getVoicePreference();
              if (voiceEnabled) {
                // Calculate next direction and announce it
                const currentPoint = currentPath[currentSegmentIndex];
                const nextPoint = currentPath[currentSegmentIndex + 1];
                const afterNextPoint = currentSegmentIndex + 2 < currentPath.length ? 
                                    currentPath[currentSegmentIndex + 2] : null;
                
                // Get next instruction but modify it to be more suitable for post-turn
                const nextInstruction = generateNavigationInstruction(
                  currentPoint, nextPoint, afterNextPoint
                );
                
                // Replace "In X meters" with "Now" for immediate instruction
                const postTurnInstruction = nextInstruction.replace(
                  /In \d+ meters,/i, 
                  "Now"
                );
                
                // Speak the turn completion instruction
                speakInstruction(postTurnInstruction);
                lastInstructionTimeRef.current = Date.now();
              }
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
  }, [path, obstacles, simulationSpeed, simulationIntervalMs, onObstacleDetected, provideNavigationInstruction]);
  
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
    
    // Reset the distance update tracker
    lastDistanceUpdateRef.current = 0;
    
    try {
      // Start simulation directly with the current path without checking for obstacles beforehand
      console.log("Starting simulation on current path");
      const startPoint = path[0];
      setCurrentLocation(startPoint);
      
      // Generate initial instruction right away using the first two path points
      if (path.length >= 2) {
        const nextPoint = path[1];
        const afterNextPoint = path.length > 2 ? path[2] : null;
        
        // Calculate an initial instruction based on the first segment
        const initialInstruction = generateNavigationInstruction(
          startPoint, 
          nextPoint, 
          afterNextPoint
        );
        
        // Set as the current instruction
        setCurrentInstruction(initialInstruction);
      }
      
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

    // Generate all instructions for the path
    const pathInstructions = generateFullPathInstructions(path);
    setInstructionHistory(pathInstructions);
  }, [path, startSimulationFromPoint, generateFullPathInstructions, generateNavigationInstruction]);
  
  // Resume simulation after rerouting
  const resumeSimulation = useCallback(() => {
    if (!obstacleDetected || !path || path.length < 2) {
      console.error("Cannot resume: no obstacle was detected or path is invalid");
      return;
    }
    
    console.log("Resuming simulation with new path");
    setObstacleDetected(false);
    setObstacleLocation(null);
    
    if (getVoicePreference()) {
      const resumeInstruction = "Route recalculated. Continuing navigation.";
      setCurrentInstruction(resumeInstruction);
      speakInstruction(resumeInstruction);
    }
    
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
    resumeSimulation,
    currentInstruction,
    instructionHistory
  };
};

export default useSimulation; 