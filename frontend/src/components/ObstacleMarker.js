import React from 'react';
import { Circle } from 'react-leaflet';

// Component to display an obstacle on the map
const ObstacleMarker = ({ obstacle, setObstacles }) => {
  // Function to remove this obstacle
  const removeObstacle = () => {
    setObstacles(prev => prev.filter(obs => obs.id !== obstacle.id));
  };
  
  return (
    <Circle
      center={obstacle.position}
      radius={obstacle.radius}
      pathOptions={{
        color: '#D83B01',
        fillColor: '#D83B01',
        fillOpacity: 0.4,
        weight: 2
      }}
      eventHandlers={{
        click: (e) => {
          // Stop propagation to prevent map click handler from firing
          e.originalEvent.stopPropagation();
          // Remove obstacle on click
          removeObstacle();
        }
      }}
    />
  );
};

export default ObstacleMarker; 