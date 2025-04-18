import React from 'react';

const ControlButtons = ({
  cleanupAllOperations,
  findPath,
  startLat,
  startLon,
  startLocation,
  endLat,
  endLon,
  endLocation,
  simulateMovement,
  detectionRunning,
  startDetection,
  stopDetection,
  placingObstacle,
  setPlacingObstacle,
  clearObstacles
}) => {
  return (
    <div className="buttons">
      <button onClick={() => {
        cleanupAllOperations();
        // Create start and end objects from the current values
        const start = {
          lat: startLat,
          lng: startLon,
          lon: startLon,
          name: startLocation
        };
        const end = {
          lat: endLat,
          lng: endLon,
          lon: endLon,
          name: endLocation
        };
        findPath(start, end);
      }}>Find Path</button>

      <button onClick={() => {
        cleanupAllOperations();
        simulateMovement();
      }}>Simulate Movement</button>

      {!detectionRunning ? (
        <button onClick={() => {
          cleanupAllOperations();
          startDetection();
        }}>Start Detection</button>
      ) : (
        <button onClick={() => {
          stopDetection();
          cleanupAllOperations();
        }}>Stop Detection</button>
      )}
      
      {/* Obstacle controls */}
      <button 
        onClick={() => {
          cleanupAllOperations();
          setPlacingObstacle(!placingObstacle);
        }}
        className={placingObstacle ? 'active' : ''}
      >
        {placingObstacle ? 'Cancel' : 'Place Obstacle'}
      </button>

      <button onClick={() => {
        cleanupAllOperations();
        clearObstacles();
      }}>Clear Obstacles</button>
    </div>
  );
};

export default ControlButtons; 