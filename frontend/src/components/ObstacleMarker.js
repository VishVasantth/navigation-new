import React, { useState, useEffect } from 'react';
import { Circle, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import { createObstacleWaypointIcon } from '../utils/mapUtils';

// Component to display an obstacle on the map
const ObstacleMarker = ({ obstacle, setObstacles }) => {
  // State to control tooltip visibility
  const [showTooltip, setShowTooltip] = useState(true);
  
  // Remove tooltip after 2 seconds
  useEffect(() => {
    if (obstacle.isDetected) {
      const tooltipTimer = setTimeout(() => {
        setShowTooltip(false);
      }, 2000);
      
      return () => clearTimeout(tooltipTimer);
    }
  }, [obstacle.isDetected]);
  
  // Function to remove this obstacle
  const removeObstacle = () => {
    setObstacles(prev => prev.filter(obs => obs.id !== obstacle.id));
  };
  
  // Determine if this is a detected obstacle from simulation
  const isDetectedObstacle = obstacle.isDetected === true;
  const isPermanentObstacle = obstacle.isPermanent === true;
  
  // For permanent detected obstacles, use a waypoint-style marker
  if (isDetectedObstacle && isPermanentObstacle) {
    return (
      <>
        {/* Add a red circle to mark the obstacle area */}
        <Circle
          center={obstacle.position}
          radius={obstacle.radius}
          pathOptions={{
            color: '#FF0000',
            fillColor: '#FF0000',
            fillOpacity: 0.2,
            weight: 2
          }}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              removeObstacle();
            }
          }}
        />
        
        {/* Add a waypoint-style marker */}
        <Marker
          position={obstacle.position}
          icon={createObstacleWaypointIcon()}
          zIndex={35}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              removeObstacle();
            }
          }}
        >
          {showTooltip && (
            <Tooltip permanent direction="top" offset={[0, -5]}>
              Obstacle detected!<br/>
              Navigation halted
            </Tooltip>
          )}
        </Marker>
      </>
    );
  }
  
  // Use different styling for detected vs. manually placed obstacles
  const pathOptions = isDetectedObstacle ? {
    color: '#FF0000',
    fillColor: '#FF0000',
    fillOpacity: 0.6,
    weight: 2
  } : {
    color: '#D83B01',
    fillColor: '#D83B01',
    fillOpacity: 0.4,
    weight: 2
  };
  
  // Regular circle marker for non-permanent obstacles
  return (
    <Circle
      center={obstacle.position}
      radius={obstacle.radius}
      pathOptions={pathOptions}
      eventHandlers={{
        click: (e) => {
          // Stop propagation to prevent map click handler from firing
          e.originalEvent.stopPropagation();
          // Remove obstacle on click
          removeObstacle();
        }
      }}
    >
      {isDetectedObstacle && showTooltip && (
        <Tooltip permanent direction="top" offset={[0, -5]}>
          Obstacle detected!<br/>
          Navigation halted
        </Tooltip>
      )}
    </Circle>
  );
};

export default ObstacleMarker; 