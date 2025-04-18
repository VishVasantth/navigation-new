import { useMapEvents } from 'react-leaflet';

// Component to handle map clicks for placing obstacles
const ObstacleMarker = ({ obstacles, setObstacles, placingObstacle, obstacleSizeMeters }) => {
  useMapEvents({
    click: (e) => {
      if (placingObstacle) {
        const newObstacle = {
          id: Date.now(),
          position: [e.latlng.lat, e.latlng.lng],
          radius: obstacleSizeMeters // Use the size from props
        };
        console.log("Adding obstacle:", newObstacle);
        
        // Add the obstacle
        setObstacles(prev => [...prev, newObstacle]);
        
        // Dispatch a custom event to notify the main component about the new obstacle
        const customEvent = new CustomEvent('obstacleadded', { 
          detail: { obstacle: newObstacle }
        });
        window.dispatchEvent(customEvent);
      }
    }
  });
  
  return null;
};

export default ObstacleMarker; 