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
      {/* Find Path and Simulate Movement in the same row */}
      <div className="button-row">
        <button 
          className="half-width-button"
          onClick={() => {
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
          }}
        >
          Find Path
        </button>

        <button 
          className="half-width-button"
          onClick={() => {
            cleanupAllOperations();
            simulateMovement();
          }}
        >
          Simulate Movement
        </button>
      </div>

      {!detectionRunning ? (
        <button 
          className="full-width-button"
          onClick={() => {
            cleanupAllOperations();
            startDetection();
          }}
        >
          Start Detection
        </button>
      ) : (
        <button 
          className="full-width-button"
          onClick={() => {
            stopDetection();
            cleanupAllOperations();
          }}
        >
          Stop Detection
        </button>
      )}
      
      {/* Obstacle controls in the same row */}
      <div className="button-row">
        <button 
          onClick={() => {
            cleanupAllOperations();
            setPlacingObstacle(!placingObstacle);
          }}
          className={`half-width-button ${placingObstacle ? 'active' : ''}`}
        >
          {placingObstacle ? 'Cancel' : 'Place Obstacle'}
        </button>

        <button 
          className="half-width-button"
          onClick={() => {
            cleanupAllOperations();
            clearObstacles();
          }}
        >
          Clear Obstacles
        </button>
      </div>
    </div>
  );
};

export default ControlButtons; 