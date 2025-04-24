import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCompress, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';

const DetectionDisplay = ({ videoRef, detectionRunning, objects, obstacles, clearObstacles }) => {
  const [videoMinimized, setVideoMinimized] = useState(false);
  const [statusMinimized, setStatusMinimized] = useState(false);
  
  const toggleVideoSize = () => {
    setVideoMinimized(!videoMinimized);
  };
  
  const toggleStatusSize = () => {
    setStatusMinimized(!statusMinimized);
  };
  
  return (
    <>
      {/* Video feed - always visible */}
      <div className={`video-feed ${videoMinimized ? 'minimized' : ''}`}>
        <button 
          className="video-feed-toggle" 
          onClick={toggleVideoSize}
          aria-label={videoMinimized ? "Expand video" : "Minimize video"}
        >
          <FontAwesomeIcon icon={videoMinimized ? faExpand : faCompress} />
        </button>
        <img ref={videoRef} alt="Video feed" />
      </div>
      
      {/* Object detection status - only visible when detection is running */}
      {detectionRunning && (
        <div className={`detection-status ${statusMinimized ? 'minimized' : ''}`}>
          <div className="detection-status-toggle" onClick={toggleStatusSize}>
          <h3>Detected Objects: {objects.length}</h3>
            <span className="detection-status-toggle-icon">
              <FontAwesomeIcon icon={statusMinimized ? faChevronDown : faChevronUp} />
            </span>
          </div>
          
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
      )}
    </>
  );
};

export default DetectionDisplay; 