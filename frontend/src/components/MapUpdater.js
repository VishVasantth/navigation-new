import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Helper component to update map view and handle obstacle placement
const MapUpdater = ({ path, placingObstacle, setObstacles, obstacleSize }) => {
  const map = useMap();
  
  // Handle map click events for obstacle placement
  useMapEvents({
    click: (e) => {
      if (placingObstacle) {
        const newObstacle = {
          id: Date.now(),
          position: [e.latlng.lat, e.latlng.lng],
          radius: obstacleSize || 5 // Default to 5m if not specified
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
  
  useEffect(() => {
    if (path && path.length > 1) {
      try {
        console.log("Fitting map to path:", path);
        
        // Create Leaflet LatLng objects for the bounds
        const bounds = path.reduce(
          (bounds, point) => {
            // Convert point to LatLng if it's an array
            const latLng = Array.isArray(point) 
              ? L.latLng(point[0], point[1]) 
              : L.latLng(point.lat, point.lng);
            return bounds.extend(latLng);
          },
          L.latLngBounds(path[0], path[0])
        );
        
        // Add a small padding
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    }
  }, [path, map]);
  
  return null;
};

export default MapUpdater; 