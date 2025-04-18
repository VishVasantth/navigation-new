# Object Detection Backend

This backend server provides object detection capabilities using YOLOv8 and integrates with the OSM navigation frontend. It supports both webcams and RTSP camera streams.

## Features

- Real-time object detection using YOLOv8
- Support for RTSP camera streams and local webcams
- Automatic reconnection for RTSP streams if connection is lost
- Camera feed access and processing
- Obstacle detection and mapping to GPS coordinates
- RESTful API for frontend integration

## Setup

1. Install Python 3.8+ if not already installed

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv env
   # Windows
   env\Scripts\activate
   # Linux/Mac
   source env/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Ensure the YOLOv8 model weights file (`yolov8n.pt`) is in the project root directory.

## RTSP Camera Setup

To use an RTSP camera stream:

1. Set your RTSP URL:
   - Set environment variable: `RTSP_URL=rtsp://username:password@camera_ip:port/stream`
   - Or provide it in the request body when calling the `/start` endpoint

2. Example RTSP URLs:
   - Generic format: `rtsp://username:password@camera_ip:port/stream`
   - Hikvision cameras: `rtsp://username:password@camera_ip:554/Streaming/Channels/101`
   - Dahua cameras: `rtsp://username:password@camera_ip:554/cam/realmonitor?channel=1&subtype=0`
   - IP Webcam (Android app): `rtsp://camera_ip:8080/h264_ulaw.sdp`

## Usage

1. Start the backend server:
   ```bash
   python run.py
   ```

2. The server will run at `http://localhost:5001` by default.

3. The frontend will connect to this server when the "Start Detection" button is clicked.

## API Endpoints

- `POST /start`: Start the object detection service
  - Parameters:
    - `rtsp_url`: RTSP stream URL (optional, uses `RTSP_URL` env var if not provided)
    - `use_rtsp`: Boolean to use RTSP stream or webcam (default: true)
    - `camera_id`: Camera device ID if using webcam (default: 0)

- `POST /stop`: Stop the object detection service

- `GET /frame`: Get the current camera frame as JPEG

- `GET /objects`: Get detected objects with position data

- `GET /config`: Get current configuration (camera settings)

- `GET /health`: Check server health

## Configuration

The server uses these environment variables (if set):
- `PORT`: Server port (default: 5001)
- `RTSP_URL`: Default RTSP camera URL
- `CAMERA_ID`: Camera device ID to use (default: 0) when not using RTSP

## Direct Testing

You can test the detection module directly by running the detector script:

```bash
# Test with RTSP stream
python -m detection.detector --rtsp rtsp://username:password@camera_ip:port/stream

# Test with webcam
python -m detection.detector --camera 0
```

## Troubleshooting

1. RTSP connection issues:
   - Verify the URL format and credentials
   - Check that your camera is accessible on the network
   - Try VLC media player to confirm the stream works
   - Look for logs indicating reconnection attempts

2. Camera access issues:
   - Make sure your camera is properly connected
   - Try changing the camera ID when starting detection
   - Some systems may require camera permissions

3. Detection accuracy:
   - The coordinate mapping is approximate and may need calibration
   - Adjust confidence threshold if needed (default: 0.5)

4. Performance issues:
   - The detection runs every 3rd frame to improve performance
   - Consider lowering the RTSP stream resolution
   - Using a GPU will significantly improve speed 