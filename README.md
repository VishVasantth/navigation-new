# Vision-Enhanced OSM Navigation System

This project integrates object detection with OpenStreetMap (OSM) based navigation to create a robot navigation system that can detect and avoid obstacles in real-time.

## Features

- Real-time object detection using YOLO
- OpenStreetMap-based path planning
- Dynamic obstacle detection and avoidance
- Path simulation with automatic rerouting
- RTSP camera integration

## Architecture

The system consists of two main components:

1. **Backend**
   - Object Detection Service: Processes camera feeds and identifies obstacles
   - OSM Service: Handles navigation and path planning
   - Flask API: Provides endpoints for the frontend to interact with

2. **Frontend**
   - React application with interactive map interface
   - Path visualization and simulation
   - Real-time object detection feed

## Prerequisites

- Python 3.8+ for the backend
- Node.js and npm for the frontend
- RTSP camera source (can be simulated with software like OBS Studio)
- RTSP Simple Server (for video streaming)
- CUDA-capable GPU recommended for optimal performance

## Setup

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

4. Install RTSP Simple Server from: https://github.com/aler9/rtsp-simple-server/releases
   - Download the appropriate binary for your OS
   - Make it executable and place it in your PATH

5. Create a `.env` file with the following settings:
   ```
   OPENROUTE_API_KEY=your_openroute_service_api_key
   RTSP_STREAM_URL=rtsp://your_camera_stream_url
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install the required packages:
   ```
   npm install
   ```

3. Create a `.env` file with the following settings:
   ```
   REACT_APP_BACKEND_URL=http://localhost:5000
   REACT_APP_DETECTION_URL=http://localhost:5001
   REACT_APP_OPENROUTE_API_KEY=your_openroute_service_api_key
   ```

## Running the System

### Start the Backend

1. Navigate to the backend directory and activate your virtual environment
2. Start the Flask server:
   ```
   python app.py
   ```

### Start the Frontend

1. Navigate to the frontend directory
2. Start the React development server:
   ```
   npm start
   ```

### Setting Up the Camera

You can use a real RTSP camera or simulate one:

1. Using a real RTSP camera:
   - Connect the camera to your network
   - Configure it to stream via RTSP
   - Update the RTSP URL in your backend `.env` file

2. Simulating with OBS Studio:
   - Install OBS Studio
   - Set up a virtual camera with OBS
   - Configure OBS to output an RTSP stream
   - Use the RTSP URL in your backend configuration

## Using the System

1. Open your browser and navigate to `http://localhost:3000`
2. Select start and end locations on the map
3. Click "Find Path" to generate a route
4. Click "Simulate Movement" to start the simulation with object detection
5. The system will automatically detect obstacles from the camera feed and reroute when necessary

## Troubleshooting

- **Camera connection issues**: Verify the RTSP URL is correct and accessible
- **Object detection not working**: Make sure the YOLO model is properly loaded
- **Path planning issues**: Check that the OpenRoute Service API key is valid

## License

This project is licensed under the MIT License - see the LICENSE file for details. 