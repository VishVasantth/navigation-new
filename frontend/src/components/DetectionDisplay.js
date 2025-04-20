import React from 'react';

const DetectionDisplay = ({ videoRef, detectionRunning, objects, obstacles, clearObstacles }) => {
  return (
    <>
      {/* Video feed - always visible */}
      <img ref={videoRef} alt="Video feed" />
      
      {/* Object detection status - only visible when detection is running */}
      {detectionRunning && (
        <div className="detection-status">
          <h3>Detected Objects: {objects.length}</h3>
          <ul>
            {objects.map((obj, index) => (
              <li key={index}>
                {obj.class} ({obj.confidence.toFixed(2)})
                {obj.is_obstacle && (
                  <strong> (Obstacle)</strong>
                )}
              </li>
            ))}
          </ul>
          {obstacles.length > 0 && (
            <div>
              <h3>Obstacles: {obstacles.length}</h3>
              <button onClick={clearObstacles} className="clear-button">Clear All</button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DetectionDisplay; 