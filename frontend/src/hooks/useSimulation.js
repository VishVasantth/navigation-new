import { useState, useRef, useEffect, useCallback } from 'react';
import { isNearObstacle } from '../utils/obstacleUtils';
import { generateNavigationInstruction } from '../services/navigationService';
import { speakInstruction, getVoicePreference } from '../services/speechService';
import { calculateDistanceBetweenPoints } from '../utils/mapUtils';
import { 
  sendNavigationInstruction, 
  formatTurningInstruction, 
  isWebSocketConnected,
  stopMotors
} from '../services/websocketService';

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
  const [usingESP32, setUsingESP32] = useState(false);
  const lastSentInstructionRef = useRef(null);
  
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
  
  // Function to send navigation instructions to ESP32
  const sendToESP32 = useCallback((distance, direction) => {
    if (!usingESP32 || !isWebSocketConnected()) return false;
    
    // Create formatted instruction
    const instruction = formatTurningInstruction(distance, direction);
    
    // Check if this is a new instruction to avoid sending duplicates
    const instructionString = JSON.stringify(instruction);
    if (instructionString === lastSentInstructionRef.current) {
      return false;
    }
    
    // Send to ESP32 and update last sent instruction
    const success = sendNavigationInstruction(instruction);
    if (success) {
      lastSentInstructionRef.current = instructionString;
      console.log(`Sent to ESP32: ${distance}m, direction: ${direction}`);
    }
    return success;
  }, [usingESP32]);
  
  // Parse instruction text to extract distance and direction for ESP32
  const parseInstructionForESP32 = useCallback((instructionText) => {
    if (!instructionText) return null;
    
    // Parse "In X meters, turn left/right" format
    const distanceMatch = instructionText.match(/In (\d+) meters?,/i);
    const distance = distanceMatch ? parseInt(distanceMatch[1]) : 0;
    
    // Parse direction
    let direction = 'straight';
    if (instructionText.includes('turn left')) {
      direction = 'left';
    } else if (instructionText.includes('turn right')) {
      direction = 'right';
    } else if (instructionText.includes('slight left')) {
      direction = 'slight_left';
    } else if (instructionText.includes('slight right')) {
      direction = 'slight_right';
    } else if (instructionText.includes('sharp left')) {
      direction = 'sharp_left';
    } else if (instructionText.includes('sharp right')) {
      direction = 'sharp_right';
    } else if (instructionText.includes('make a u-turn')) {
      direction = 'u_turn';
    } else if (instructionText.includes('reached your destination')) {
      direction = 'stop';
      return { distance: 0, direction };
    }
    
    return { distance, direction };
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
        
        // Send stop command to ESP32
        if (usingESP32) {
          sendToESP32(0, "stop");
          stopMotors();
        }
        
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
    
    // Parse instruction for ESP32 and send if connected
    if (usingESP32) {
      const parsedInstruction = parseInstructionForESP32(instruction);
      if (parsedInstruction) {
        sendToESP32(parsedInstruction.distance, parsedInstruction.direction);
      }
    }
    
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
  }, [generateNavigationInstruction, usingESP32, sendToESP32, parseInstructionForESP32]);
  
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
    
    // Track the last segment type to detect completed turns
    let lastSegmentType = 'straight';
    let turnJustCompleted = false;
    
    if (simulationIntervalRef.current) {
      console.log("Clearing existing interval before starting new one");
      clearInterval(simulationIntervalRef.current);
    }
    
    // Create a new interval for the simulation
    const simulationInterval = setInterval(() => {
      try {
        // Always use the current path from props to ensure we have the latest re-routed path
        if (!path || path.length < 2) {
          console.error("Invalid path during simulation interval");
          clearInterval(simulationInterval);
          return;
        }
        
        // Calculate the current and next position based on path and progress
        let startPoint, endPoint;
        
        if (isMovingForward) {
          // Normal forward movement
          startPoint = path[currentSegmentIndex];
          endPoint = path[currentSegmentIndex + 1];
        } else {
          // Backward movement - reverse the points
          startPoint = path[currentSegmentIndex + 1];
          endPoint = path[currentSegmentIndex];
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
        if (currentSegmentIndex + 1 < path.length) {
          // For the next waypoint (usually an intersection or turn)
          const nextWaypoint = path[currentSegmentIndex + 1];
          const distanceToNextPoint = calculateDistanceBetweenPoints(
            [currentPosition[0], currentPosition[1]],
            [nextWaypoint[0], nextWaypoint[1]]
          );
          
          // For the next instruction point (can be further along the path)
          let instructionTarget = null;
          let nextInstructionSegment = currentSegmentIndex + 1;
          
          // Find the next point where an actual turn or action is needed
          while (nextInstructionSegment + 1 < path.length) {
            const pt1 = path[nextInstructionSegment - 1];
            const pt2 = path[nextInstructionSegment];
            const pt3 = path[nextInstructionSegment + 1];
            
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
              provideNavigationInstruction(currentPosition, currentSegmentIndex, path);
            } else {
              // Update the existing instruction with new distance
              // Get current and next points for navigation
              const currentPoint = currentPosition;
              const nextPoint = instructionTarget;
              
              // Get the point after next if available for turn instructions
              const afterNextPoint = (nextInstructionSegment + 1 < path.length) 
                                  ? path[nextInstructionSegment + 1] 
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
          provideNavigationInstruction(currentPosition, currentSegmentIndex, path);
        }
        
        // Check if we've encountered an obstacle
        if (isNearObstacle(currentPosition, obstacles, 3.0)) {
          console.log("Obstacle detected during simulation");
          
          // Store the obstacle location
          setObstacleLocation(currentPosition);
          setObstacleDetected(true);
          
          // Store the current segment and progress information for resuming from this point
          setCurrentSegmentIndex(currentSegmentIndex);
          setCurrentProgress(progressPercentage);
          
          // Stop the current simulation interval
          clearInterval(simulationInterval);
          
          // Check voice preference once
          const voiceEnabled = getVoicePreference();
          
          // Update the instruction with obstacle detection message
          const obstacleInstruction = "Obstacle detected! Re-routing...";
          setCurrentInstruction(obstacleInstruction);
          
          // Clear the movement trail up to this point
          // This ensures we only show the new path after re-routing
          setMovementTrail([]);
          
          // Provide a voice notification about the obstacle if enabled
          if (voiceEnabled) {
            speakInstruction(obstacleInstruction);
          }
          
          // Call the callback if provided
          if (onObstacleDetected && typeof onObstacleDetected === 'function') {
            onObstacleDetected(currentPosition);
            
            // Automatically begin re-routing process after a short delay
            setTimeout(() => {
              // We don't set simulationActive to false here, to indicate that navigation is still in progress
              resumeSimulation();
            }, 2000); // 2 second delay before starting re-routing
          } else {
            // If no callback is provided for re-routing, automatically resume with current path
            setTimeout(() => {
              resumeSimulation();
            }, 2000);
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
          if (currentSegmentIndex + 1 < path.length) {
            // Check if this segment was a turn
            const currentSegment = {
              from: path[Math.max(0, currentSegmentIndex - 1)],
              via: path[currentSegmentIndex],
              to: path[currentSegmentIndex + 1]
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
            if (currentSegmentIndex >= path.length - 1) {
              console.log("Reached destination, ending simulation");
              clearInterval(simulationInterval);
              setSimulationActive(false);
              
              // Final destination announcement
              const finalInstruction = "You have reached your destination.";
              setCurrentInstruction(finalInstruction);
              
              // Check voice preference and speak instruction if enabled
              const voiceEnabled = getVoicePreference();
              if (voiceEnabled) {
                speakInstruction(finalInstruction);
              }
              return;
            }
            
            // If we just completed a turn, announce the next direction
            if (turnJustCompleted && currentSegmentIndex + 1 < path.length) {
              const voiceEnabled = getVoicePreference();
              if (voiceEnabled) {
                // Calculate next direction and announce it
                const currentPoint = path[currentSegmentIndex];
                const nextPoint = path[currentSegmentIndex + 1];
                const afterNextPoint = currentSegmentIndex + 2 < path.length ? 
                                    path[currentSegmentIndex + 2] : null;
                
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
        
        // Send initial instruction to ESP32 if enabled
        if (usingESP32) {
          const parsedInstruction = parseInstructionForESP32(initialInstruction);
          if (parsedInstruction) {
            sendToESP32(parsedInstruction.distance, parsedInstruction.direction);
          }
        }
        
        // Speak initial instruction if voice is enabled
        const voiceEnabled = getVoicePreference();
        if (voiceEnabled) {
          speakInstruction(initialInstruction);
        }
      }
      
      // First, generate all instructions for the path
      const pathInstructions = generateFullPathInstructions(path);
      setInstructionHistory(pathInstructions);
      
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
  }, [
    path, 
    startSimulationFromPoint, 
    generateFullPathInstructions, 
    generateNavigationInstruction,
    usingESP32,
    parseInstructionForESP32,
    sendToESP32
  ]);
  
  // Resume simulation after rerouting
  const resumeSimulation = useCallback(() => {
    // Modified to allow resuming even if obstacleDetected is false
    if (!path || path.length < 2) {
      console.error("Cannot resume: path is invalid");
      return;
    }
    
    console.log("Resuming simulation with new path", path);
    
    // Reset obstacle detection flags but keep position for reference
    setObstacleDetected(false);
    const obstaclePoint = obstacleLocation;
    
    // Ensure simulation is active
    setSimulationActive(true);
    
    // Reset movement trail to clear the old path visualization
    setMovementTrail([]);
    
    // Check voice preference once and use it throughout
    const voiceEnabled = getVoicePreference();
    
    // Show re-routing message in the navigation card
    const reroutingInstruction = "Re-routing path...";
    setCurrentInstruction(reroutingInstruction);
    
    // Announce re-routing based on voice preference
    if (voiceEnabled) {
      speakInstruction(reroutingInstruction);
      
      // Add a small delay before announcing the resumption of navigation
      setTimeout(() => {
        const resumeInstruction = "Route recalculated. Continuing navigation from current location.";
        setCurrentInstruction(resumeInstruction);
        speakInstruction(resumeInstruction);
        
        // Generate new instructions for the re-routed path
        const newPathInstructions = generateFullPathInstructions(path);
        setInstructionHistory(newPathInstructions);
        
        // Important: The new path's first point should be at or near the obstacle location
        // since the path is recalculated from the obstacle point
        if (path.length > 0) {
          // Set current location to the first point of the new path
          setCurrentLocation(path[0]);
          
          // Log for debugging
          console.log("Resuming navigation from:", path[0], 
                      "Original obstacle at:", obstaclePoint);
        }
        
        // Start simulation from the beginning of the new path (segment 0)
        // The new path already starts from the obstacle location
        startSimulationFromPoint(0, 0);
      }, 2000); // 2 second delay to allow for the re-routing message to be heard
    } else {
      // If voice is disabled, show "re-routing" message briefly before resuming
      setTimeout(() => {
        const resumeInstruction = "Route recalculated. Continuing navigation from current location.";
        setCurrentInstruction(resumeInstruction);
        
        // Generate new instructions for the re-routed path
        const newPathInstructions = generateFullPathInstructions(path);
        setInstructionHistory(newPathInstructions);
        
        // Set current location to the first point of the new path
        if (path.length > 0) {
          setCurrentLocation(path[0]);
          
          // Log for debugging
          console.log("Resuming navigation from:", path[0], 
                      "Original obstacle at:", obstaclePoint);
        }
        
        // Start simulation from the beginning of the new path (segment 0)
        // The new path already starts from the obstacle location
        startSimulationFromPoint(0, 0);
      }, 1500);
    }
  }, [path, obstacleLocation, startSimulationFromPoint, generateFullPathInstructions]);
  
  // Toggle ESP32 control mode
  const toggleESP32Mode = useCallback(() => {
    setUsingESP32(prev => !prev);
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      // Send stop command to ESP32 when unmounting
      if (usingESP32) {
        stopMotors();
      }
    };
  }, [usingESP32]);
  
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
    instructionHistory,
    // New ESP32-related values
    usingESP32,
    toggleESP32Mode
  };
};

export default useSimulation; 