import React from 'react';

const DetectionDisplay = ({ videoRef, objects, obstacles, clearObstacles }) => {
  return (
    <>
      {/* Video feed */}
      <div className="video-feed">
        <img ref={videoRef} alt="Video feed" />
      </div>
      
      {/* Object detection status */}
      <div className="detection-status">
        <h3>Detected Objects: {objects.length}</h3>
        <ul>
          {objects.map((obj, index) => (
            <li key={index}>
              Class: {obj.class}, Confidence: {obj.confidence.toFixed(2)}
              {obj.is_obstacle && (
                <strong> (Obstacle) at [{obj.position[0].toFixed(6)}, {obj.position[1].toFixed(6)}]</strong>
              )}
            </li>
          ))}
        </ul>
        {obstacles.length > 0 && (
          <div>
            <h3>Obstacles: {obstacles.length}</h3>
            <button onClick={clearObstacles}>Clear All</button>
          </div>
        )}
      </div>
    </>
  );
};

export default DetectionDisplay; 