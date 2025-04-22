import React, { useState } from 'react';
import { speakInstruction, isSpeechAvailable, getVoicePreference, saveVoicePreference } from '../services/speechService';
import { generateNavigationInstruction } from '../services/navigationService';
import { calculateBearing, getDirectionText } from '../utils/navigationUtils';

const ControlButtons = ({
  cleanupAllOperations,
  findPath,
  startLat,
  startLon,
  startLocation,
  endLat,
  endLon,
  endLocation,
  simulateMovement,
  detectionRunning,
  startDetection,
  stopDetection,
  placingObstacle,
  setPlacingObstacle,
  clearObstacles
}) => {
  // State for navigation options
  const [voiceNavigationEnabled, setVoiceNavigationEnabled] = useState(getVoicePreference());
  const [showNavigationOptions, setShowNavigationOptions] = useState(false);
  
  // Function to start navigation with selected options
  const startNavigation = () => {
    // Save voice preference
    saveVoicePreference(voiceNavigationEnabled);
    
    // Close the options panel
    setShowNavigationOptions(false);
    
    // If voice is enabled, speak the initial instruction
    if (voiceNavigationEnabled && isSpeechAvailable()) {
      speakInstruction("Starting navigation. Follow the blue route.");
    }
    
    // Start the simulation movement
    cleanupAllOperations();
    simulateMovement();
  };
  
  return (
    <div className="buttons">
      {/* Find Path and Start Navigation in the same row */}
      <div className="button-row">
        <button 
          className="half-width-button"
          onClick={() => {
            cleanupAllOperations();
            // Create start and end objects from the current values
            const start = {
              lat: startLat,
              lng: startLon,
              lon: startLon,
              name: startLocation
            };
            const end = {
              lat: endLat,
              lng: endLon,
              lon: endLon,
              name: endLocation
            };
            findPath(start, end);
          }}
        >
          Find Path
        </button>

        <button 
          className="half-width-button"
          onClick={() => {
            // Show navigation options panel instead of starting immediately
            setShowNavigationOptions(!showNavigationOptions);
          }}
        >
          Start Navigation
        </button>
      </div>
      
      {/* Navigation Options Panel */}
      {showNavigationOptions && (
        <div className="navigation-options">
          <div className="option-row">
            <label>
              <input 
                type="checkbox" 
                checked={voiceNavigationEnabled}
                onChange={(e) => setVoiceNavigationEnabled(e.target.checked)}
              />
              Enable Voice Navigation
            </label>
          </div>
          
          <div className="button-row navigation-action-buttons">
            <button 
              onClick={() => setShowNavigationOptions(false)}
              className="half-width-button secondary-button"
            >
              Cancel
            </button>
            <button 
              onClick={startNavigation}
              className="half-width-button primary-button"
            >
              Begin Navigation
            </button>
          </div>
        </div>
      )}

      {!detectionRunning ? (
        <button 
          className="full-width-button"
          onClick={() => {
            cleanupAllOperations();
            startDetection();
          }}
        >
          Start Detection
        </button>
      ) : (
        <button 
          className="full-width-button"
          onClick={() => {
            stopDetection();
            cleanupAllOperations();
          }}
        >
          Stop Detection
        </button>
      )}
      
      {/* Obstacle controls in the same row */}
      <div className="button-row">
        <button 
          onClick={() => {
            cleanupAllOperations();
            setPlacingObstacle(!placingObstacle);
          }}
          className={`half-width-button ${placingObstacle ? 'active' : ''}`}
        >
          {placingObstacle ? 'Cancel' : 'Place Obstacle'}
        </button>

        <button 
          className="half-width-button"
          onClick={() => {
            cleanupAllOperations();
            clearObstacles();
          }}
        >
          Clear Obstacles
        </button>
      </div>
    </div>
  );
};

export default ControlButtons; 