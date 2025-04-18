# Vision-Enhanced OSM Navigation Backend

This backend provides the object detection and OpenStreetMap (OSM) services for the robot navigation system.

## Architecture

The backend consists of two main components:

1. **Object Detection Service** - Processes camera feeds to detect objects and obstacles using YOLO
2. **OSM Service** - Handles navigation routing, including obstacle avoidance and rerouting

## Setup

### Requirements

- Python 3.8+
- CUDA-capable GPU for optimal performance (for Jetson Nano)
- RTSP camera stream source

### Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Install the RTSP Simple Server:

RTSP Simple Server is used for streaming video. You can download it from: 
https://github.com/aler9/rtsp-simple-server/releases

Place the binary in a location in your PATH.

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
OPENROUTE_API_KEY=your_openroute_service_api_key
RTSP_STREAM_URL=rtsp://your_camera_stream_url
```

## Usage

### Starting the Backend

```bash
python app.py
```

This starts the Flask server on port 5000.

### API Endpoints

#### Health Check
- `GET /health` - Check if the server is running

#### Object Detection
- `POST /detection/start` - Start object detection with a given camera URL
- `POST /detection/stop` - Stop object detection
- `GET /detection/objects` - Get detected objects

#### OSM Routing
- `POST /osm/route` - Get a route between two points
- `GET /osm/obstacles` - Get all recorded obstacles
- `POST /osm/obstacles` - Add a new obstacle
- `DELETE /osm/obstacles/{obstacle_id}` - Remove an obstacle
- `POST /osm/obstacles/clear` - Clear all obstacles
- `POST /osm/reroute` - Reroute based on current position and obstacles

## Integration with Frontend

The frontend communicates with this backend via HTTP requests. The backend provides:

1. Routing information through the OSM service
2. Real-time object detection data
3. Obstacle management for navigation

## Customization

### Object Detection Model

The system uses YOLOv8 nano by default. To use a different model:

1. Replace the model file in `object_detection/models/`
2. Update the model path in `object_detection/detection_service.py`

### Map Area

To change the map area:

1. Update the center point in `osm_server/osm_service.py` in the `_load_graph` method

## Troubleshooting

- **Object Detection Issues**: Check that the RTSP URL is correct and accessible
- **Routing Issues**: Verify that the OpenRouteService API key is valid
- **Performance Issues**: Consider using a lighter model on resource-constrained devices 