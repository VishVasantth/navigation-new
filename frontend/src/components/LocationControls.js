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

  // Function to get user's current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLon = position.coords.longitude;
          
          // Update the start location to "Your Current Location"
          setStartLocation("Your Current Location");
          setStartLat(userLat.toString());
          setStartLon(userLon.toString());
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your current location. Please enable location services in your browser.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  return (
    <>
      <div className="input-group">
        <label>Start Location</label>
        <div className="location-input-container">
          <select 
            value={startLocation} 
            onChange={handleStartLocationChange}
          >
            {startLocation === "Your Current Location" && (
              <option value="Your Current Location">Your Current Location</option>
            )}
            {AMRITA_LOCATIONS.map((loc) => (
              <option key={`start-${loc.name}`} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
          <button 
            className="gps-button" 
            onClick={getCurrentLocation}
            title="Use GPS to get your current location"
          >
            📍
          </button>
        </div>
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