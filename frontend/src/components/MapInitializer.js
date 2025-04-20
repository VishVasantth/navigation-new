import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Component to handle initial map position and adjust for side panel
const MapInitializer = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    // Ensures the map is properly sized and centered
    const adjustMapCenter = () => {
      map.invalidateSize();
      map.setView(center, zoom, {
        animate: false
      });
    };
    
    // Initial adjustment
    adjustMapCenter();
    
    // Also adjust when window is resized
    window.addEventListener('resize', adjustMapCenter);
    
    // Small delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(() => {
      adjustMapCenter();
    }, 250);
    
    return () => {
      window.removeEventListener('resize', adjustMapCenter);
      clearTimeout(timeoutId);
    };
  }, [map, center, zoom]);
  
  return null;
};

export default MapInitializer; 