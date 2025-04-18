import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Helper component to update map view when path changes
const MapUpdater = ({ path }) => {
  const map = useMap();
  
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