// Config and constants for the application

// API Keys and URLs
export const DETECTION_URL = process.env.REACT_APP_DETECTION_URL || 'http://localhost:5001';
export const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY || 'c89eaf47-5623-42fc-b036-dd6ca73eadff';
export const OPENROUTE_SERVICE_URL = process.env.REACT_APP_OPENROUTE_URL || 'https://api.openrouteservice.org';
export const OPENROUTE_SERVICE_KEY = process.env.REACT_APP_OPENROUTE_API_KEY || '5b3ce3597851110001cf6248915f1d0c22b5d77003a1bb46c13c029cce3c74cc24bcd250f9f9b18f';

// Map Settings
export const DEFAULT_CENTER = [10.903831, 76.899839]; // Arjuna Statue at Amrita
export const MAP_BOUNDS = [
  [10.897, 76.894], // Southwest corner
  [10.910, 76.905]  // Northeast corner
];

// Simulation Settings
export const MAX_TRAIL_LENGTH = 20;
export const DEFAULT_OBSTACLE_SIZE_METERS = 5;

// Amrita campus locations
export const AMRITA_LOCATIONS = [
  {name: "A1 Staff Quarters", lat: 10.901408, lon: 76.900564},
  {name: "AB1", lat: 10.900501, lon: 76.902866},
  {name: "AB1 Car parking", lat: 10.900806, lon: 76.901861},
  {name: "AB1 Gym", lat: 10.901732, lon: 76.904144},
  {name: "AB2", lat: 10.903632, lon: 76.898394},
  {name: "AB3", lat: 10.906180, lon: 76.897778},
  {name: "AB4 - Amrita School of AI", lat: 10.904236, lon: 76.903576},
  {name: "Adithi Bhavanam", lat: 10.907319, lon: 76.898877},
  {name: "Advanced Multifunctional Materials and Analysis Lab", lat: 10.904150, lon: 76.898912},
  {name: "Aerospace Lab", lat: 10.902235, lon: 76.904414},
  {name: "Agasthya Bhavanam", lat: 10.902492, lon: 76.896217},
  {name: "Agasthya Bhavanam Mess", lat: 10.902944, lon: 76.896219},
  {name: "Amrita Ashram", lat: 10.902068, lon: 76.901058},
  {name: "Amrita Automotive Research and Testing Centre(AARTC)", lat: 10.903807, lon: 76.895610},
  {name: "Amrita Guest House", lat: 10.901419, lon: 76.898799},
  {name: "Amrita ICTS Office", lat: 10.900775, lon: 76.902631},
  {name: "Amrita Kripa Labs(CoE-AMGT)", lat: 10.901223, lon: 76.902384},
  {name: "Amrita Multi Dimensional Data Analytics Lab", lat: 10.900833, lon: 76.902765},
  {name: "Amrita Recycling Centre(ARC)", lat: 10.908921, lon: 76.90192},
  {name: "Amrita School of Business", lat: 10.904433, lon: 76.901833},
  {name: "Amrita School of physical Sciences", lat: 10.903792, lon: 76.898097},
  {name: "Amrita Sewage Treatment Plant", lat: 10.900125, lon: 76.900002},
  {name: "Amritanjali Hall", lat: 10.904666, lon: 76.899220},
  {name: "Amriteshwari Hall", lat: 10.900436, lon: 76.903798},
  {name: "Anokha hub", lat: 10.901236, lon: 76.901742},
  {name: "Anugraha Hall", lat: 10.906226, lon: 76.898032},
  {name: "Arjuna Statue", lat: 10.903831, lon: 76.899839},
  {name: "Ashram Office", lat: 10.902727, lon: 76.901229},
  {name: "Auditorium", lat: 10.904451, lon: 76.902588},
  {name: "B7B Quarters", lat: 10.908074, lon: 76.899355},
  {name: "Basketball Court 1", lat: 10.900774, lon: 76.904054},
  {name: "Basketball Court 2", lat: 10.901147, lon: 76.904080},
  {name: "Bhrigu Bhavanam", lat: 10.905331, lon: 76.904187},
  {name: "Binding Shop", lat: 10.904569, lon: 76.899354}
];

// Path styling
export const PATH_COLORS = [
  '#0078D7', // Blue (primary)
  '#107C10', // Green
  '#D83B01', // Orange/Red
  '#5C2D91', // Purple
  '#00B294', // Teal
  '#C239B3', // Magenta
  '#FFB900', // Gold
  '#E81123', // Red
  '#4A154B', // Deep Purple
  '#2D7D9A'  // Steel Blue
];

// Helper function to check if API keys are valid
export const isApiKeyValid = (key) => {
  return key && key.length > 10;
}; 