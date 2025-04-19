import React from 'react';
import { AMRITA_LOCATIONS } from '../config/constants';

const LocationControls = ({ 
  startLocation, 
  setStartLocation, 
  endLocation, 
  setEndLocation,
  startLat,
  setStartLat,
  startLon,
  setStartLon,
  endLat,
  setEndLat,
  endLon,
  setEndLon
}) => {
  // Function to handle start location change
  const handleStartLocationChange = (e) => {
    const locationName = e.target.value;
    setStartLocation(locationName);
    
    const location = AMRITA_LOCATIONS.find(loc => loc.name === locationName);
    if (location) {
      setStartLat(location.lat.toString());
      setStartLon(location.lon.toString());
    }
  };
  
  // Function to handle end location change
  const handleEndLocationChange = (e) => {
    const locationName = e.target.value;
    setEndLocation(locationName);
    
    const location = AMRITA_LOCATIONS.find(loc => loc.name === locationName);
    if (location) {
      setEndLat(location.lat.toString());
      setEndLon(location.lon.toString());
    }
  };

  return (
    <>
      <div className="input-group">
        <label>Start Location</label>
        <select 
          value={startLocation} 
          onChange={handleStartLocationChange}
        >
          {AMRITA_LOCATIONS.map((loc) => (
            <option key={`start-${loc.name}`} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="input-group">
        <label>Destination</label>
        <select 
          value={endLocation} 
          onChange={handleEndLocationChange}
        >
          {AMRITA_LOCATIONS.map((loc) => (
            <option key={`end-${loc.name}`} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

export default LocationControls; 