import React from 'react';
import '../styles/RouteSelector.css';
import { PATH_COLORS } from '../config/constants';

// Component for selecting routes and displaying route information
const RouteSelector = ({ routes, selectedPathIndex, selectPath, showAllPaths, toggleShowAllPaths }) => {
  // Helper to format distance in meters to appropriate units
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  };

  // Helper to format time in minutes
  const formatTime = (minutes) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)} sec`;
    } else if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours} hr ${mins} min`;
    }
  };

  // Helper to get a descriptive name for the route
  const getRouteName = (route, index) => {
    if (route.isDirectPath) {
      return "Direct Path";
    }
    
    // Use comparison to first route to create descriptive names
    if (index === 0) {
      return "Fastest Route";
    }
    
    const firstRoute = routes[0];
    const timeDiff = route.time - firstRoute.time;
    const distanceDiff = route.distance - firstRoute.distance;
    
    if (distanceDiff < -20) {
      return "Shorter Alternative";
    } else if (distanceDiff > 20) {
      return "Longer Alternative";
    } else if (timeDiff < -1) {
      return "Quicker Alternative";
    } else if (timeDiff > 1) {
      return "Slower Alternative";
    } else {
      return `Alternative ${index}`;
    }
  };

  return (
    <div className="route-selector">
      {/* <h3>Available Routes</h3> */}
      
      {/* <div className="route-controls">
        <button 
          className={`show-all-button ${showAllPaths ? 'active' : ''}`}
          onClick={toggleShowAllPaths}
        >
          {showAllPaths ? 'Hide Alternative Routes' : 'Show All Routes'}
        </button>
      </div> */}
      
      {routes.length <= 1 ? (
        <div className="no-alternatives-message">
          <p>Only one route available. Try using locations with multiple connected roads or points near intersections for more route options.</p>
        </div>
      ) : (
        <div className="routes-list">
          {routes.slice(0, 2).map((route, index) => (
            <div 
              key={`route-${index}`} 
              className={`route-item ${selectedPathIndex === index ? 'selected' : ''}`}
              onClick={() => selectPath(index)}
            >
              <div className="route-color" style={{ backgroundColor: PATH_COLORS[index % PATH_COLORS.length] }}></div>
              <div className="route-details">
                <div className="route-name">
                  {getRouteName(route, index)}
                  {/* {selectedPathIndex === index && <span className="selected-indicator"> (Selected)</span>} */}
                </div>
                <div className="route-stats">
                  <span className="route-distance">{formatDistance(route.distance)}</span>
                  <span className="route-time">{formatTime(route.time)}</span>
                </div>
                {route.isDirectPath && (
                  <div className="route-direct-badge">Direct Path</div>
                )}
              </div>
              {/* {selectedPathIndex !== index && (
                <button 
                  className="select-route-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectPath(index);
                  }}
                >
                  Select
                </button>
              )} */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteSelector; 