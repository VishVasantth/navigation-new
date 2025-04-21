// Config and constants for the application

// API Keys and URLs
export const DETECTION_URL = process.env.REACT_APP_DETECTION_URL || 'http://localhost:5001';
export const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY || 'c89eaf47-5623-42fc-b036-dd6ca73eadff';
export const OPENROUTE_SERVICE_URL = process.env.REACT_APP_OPENROUTE_URL || 'https://api.openrouteservice.org';
export const OPENROUTE_SERVICE_KEY = process.env.REACT_APP_OPENROUTE_API_KEY || '5b3ce3597851110001cf6248915f1d0c22b5d77003a1bb46c13c029cce3c74cc24bcd250f9f9b18f';

// Map Settings
export const DEFAULT_CENTER = [10.903831, 76.897862]; // Shifted 2% more to the left
// export const MAP_BOUNDS = [
//   [10.896, 76.891], // Southwest corner - expanded by 2%
//   [10.911, 76.906]  // Northeast corner - expanded by 2%
// ];

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
  {name: "Binding Shop", lat: 10.904569, lon: 76.899354},
  {name: "Boys Hostel Gym", lat: 10.901495, lon: 76.894817},
  {name: "Business School Dean's Residence", lat: 10.901666, lon: 76.899996},
  {name: "CAD/CAM Lab", lat: 10.900823, lon: 76.902932},
  {name: "Central Kitchen", lat: 10.901341, lon: 76.901285},
  {name: "Central Library", lat: 10.904327, lon: 76.899087},
  {name: "Children's park", lat: 10.901169, lon: 76.899532},
  {name: "Clinic", lat: 10.901687, lon: 76.901747},
  {name: "Corporate & Industry Relations (CIR)", lat: 10.905481, lon: 76.901931},
  {name: "Courier Office", lat: 10.899771, lon: 76.900355},
  {name: "Cyber Security Parking", lat: 10.904843, lon: 76.899355},
  {name: "D Quarters", lat: 10.899728, lon: 76.903768},
  {name: "Department of Amrita Dharshanam", lat: 10.900623, lon: 76.902572},
  {name: "Department of EEE", lat: 10.903929, lon: 76.898086},
  {name: "Department of Mass Communication", lat: 10.904966, lon: 76.899016},
  {name: "Dhanalakshmi Bank", lat: 10.899612, lon: 76.900380},
  {name: "Dhanalakshmi Bank ATM", lat: 10.903702, lon: 76.897667},
  {name: "Director - ICT Residence", lat: 10.901403, lon: 76.900258},
  {name: "Ettimadai Railway Station", lat: 10.898481, lon: 76.895996},
  {name: "Fabrication Workshops", lat: 10.905230, lon: 76.895213},
  {name: "Gargi Bhavanam", lat: 10.902945, lon: 76.899777},
  {name: "Gargi Bhavanam Parking Space", lat: 10.902551, lon: 76.899770},
  {name: "Gargi Ground", lat: 10.902261, lon: 76.900403},
  {name: "Gautama Buddha Statue", lat: 10.905928, lon: 76.898141},
  {name: "Gauthama Bhavanam", lat: 10.902692, lon: 76.897162},
  {name: "General Store", lat: 10.901677, lon: 76.901655},
  {name: "Girls Gym", lat: 10.902203, lon: 76.900108},
  {name: "Hall Rd 1", lat: 10.899342, lon: 76.902835},
  {name: "Hall Rd 2", lat: 10.899846, lon: 76.903512},
  {name: "ICICI Bank ATM", lat: 10.902619, lon: 76.900232},
  {name: "IT Canteen", lat: 10.904912, lon: 76.898071},
  {name: "Indoor Badminton Court", lat: 10.901300, lon: 76.894802},
  {name: "Jaanus Makeover", lat: 10.900142, lon: 76.899144},
  {name: "Kapila Bhavanam", lat: 10.904330, lon: 76.900520},
  {name: "LAB2 Mechanical", lat: 10.902467, lon: 76.904226},
  {name: "Library Garden", lat: 10.903789, lon: 76.899216},
  {name: "Main Canteen", lat: 10.900116, lon: 76.903719},
  {name: "Main Ground", lat: 10.902690, lon: 76.902975},
  {name: "Main Ground", lat: 10.904535, lon: 76.902238},
  {name: "Mechanical labs", lat: 10.901284, lon: 76.902884},
  {name: "Mythereyi Bhavanam", lat: 10.900678, lon: 76.901274},
  {name: "Nachiketas Bhavanam", lat: 10.900495, lon: 76.904800},
  {name: "Nachiketas Hostel", lat: 10.901356, lon: 76.904775},
  {name: "Natarajar Statue", lat: 10.903263, lon: 76.898437},
  {name: "Naturals Spa & Unisex Saloon", lat: 10.901703, lon: 76.901816},
  {name: "Night Canteen", lat: 10.902343, lon: 76.896724},
  {name: "Nursery", lat: 10.900014, lon: 76.901769},
  {name: "Physical Education & Gym", lat: 10.901852, lon: 76.902096},
  {name: "Printout/Xerox", lat: 10.904437, lon: 76.899292},
  {name: "Public Washroom", lat: 10.901576, lon: 76.902760},
  {name: "Robotics and Pneumatics Lab", lat: 10.900465, lon: 76.90330},
  {name: "SAE Workshop", lat: 10.901376, lon: 76.903238},
  {name: "SBI ATM", lat: 10.901782, lon: 76.901881},
  {name: "Sandeepini Hall", lat: 10.903692, lon: 76.898172},
  {name: "Saraswati Statue", lat: 10.899964, lon: 76.902850},
  {name: "Social Work Department", lat: 10.904889, lon: 76.898897},
  {name: "Staff Parking lot", lat: 10.900760, lon: 76.902234},
  {name: "Staff Quarters", lat: 10.900442, lon: 76.898709},
  {name: "Staff Quarters Rd", lat: 10.900126, lon: 76.899772},
  {name: "Swimming Pool", lat: 10.906309, lon: 76.898892},
  {name: "Tennis Court", lat: 10.899484, lon: 76.901769},
  {name: "Vasishtha Bhavanam", lat: 10.901575, lon: 76.896059},
  {name: "Volley Ball Court 1", lat: 10.900899, lon: 76.904301},
  {name: "Vyasa Maharishi Bhavanam", lat: 10.901623, lon: 76.905756},
  {name: "YB Annex", lat: 10.902790, lon: 76.905037},
  {name: "YB Mess", lat: 10.901342, lon: 76.904348},
  {name: "Yesodha Vanam", lat: 10.903280, lon: 76.902175}
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