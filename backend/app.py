import os
import logging
from flask import Flask, jsonify, Response, request
from flask_cors import CORS

from detection.detector import ObjectDetector

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize our object detector
detector = None

# Default RTSP URL - replace with your actual RTSP camera URL
DEFAULT_RTSP_URL = os.environ.get('RTSP_URL', 'rtsp://192.168.174.60:1935/')

@app.route('/start', methods=['POST'])
def start_detection():
    """Start the object detection service"""
    global detector
    
    try:
        # If detector is already running, stop it first
        if detector and detector.is_running:
            detector.stop()
            
        # Get parameters from request
        data = request.json if request.is_json else {}
        
        # Get camera source - RTSP URL takes precedence over camera ID
        rtsp_url = data.get('rtsp_url') or DEFAULT_RTSP_URL
        use_rtsp = data.get('use_rtsp', True)  # Default to using RTSP
        
        # Camera ID is used only if not using RTSP
        camera_id = data.get('camera_id', 0)
        
        # Log the source being used
        if use_rtsp:
            logger.info(f"Starting detection with RTSP URL: {rtsp_url}")
        else:
            logger.info(f"Starting detection with local camera ID: {camera_id}")
            rtsp_url = None
        
        # Initialize detector with YOLO model
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'yolov8n.pt')
        
        detector = ObjectDetector(
            model_path=model_path,
            camera_id=camera_id,
            rtsp_url=rtsp_url if use_rtsp else None
        )
        
        # Start detection in background thread
        detector.start()
        
        return jsonify({
            'status': 'success',
            'message': 'Object detection started successfully',
            'source': rtsp_url if use_rtsp else f'Camera ID {camera_id}'
        })
        
    except Exception as e:
        logger.error(f"Error starting detection: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to start detection: {str(e)}'
        }), 500

@app.route('/stop', methods=['POST'])
def stop_detection():
    """Stop the object detection service"""
    global detector
    
    try:
        if detector:
            detector.stop()
            return jsonify({
                'status': 'success',
                'message': 'Object detection stopped successfully'
            })
        else:
            return jsonify({
                'status': 'warning',
                'message': 'No active detection to stop'
            })
            
    except Exception as e:
        logger.error(f"Error stopping detection: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to stop detection: {str(e)}'
        }), 500

@app.route('/frame', methods=['GET'])
def get_frame():
    """Get the current video frame"""
    global detector
    
    try:
        # If detector exists, try to get a frame
        if detector:
            # If detection is running, get the frame from the detector
            if detector.is_running:
                frame_jpg = detector.get_frame_jpg()
                if frame_jpg:
                    return Response(frame_jpg, mimetype='image/jpeg')
            
            # If detection is not running or no frame available, initialize camera and get a frame
            if not hasattr(detector, 'cap') or detector.cap is None:
                detector.initialize_camera()
            
            # Capture a single frame
            frame_jpg = detector.get_frame_jpg(detect=False)
            if frame_jpg:
                return Response(frame_jpg, mimetype='image/jpeg')
        
        # If we still don't have a frame, return an error
        return jsonify({
            'status': 'error',
            'message': 'No frame available'
        }), 404
            
    except Exception as e:
        logger.error(f"Error getting frame: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to get frame: {str(e)}'
        }), 500

@app.route('/objects', methods=['GET'])
def get_objects():
    """Get the currently detected objects"""
    global detector
    
    try:
        if detector and detector.is_running:
            objects = detector.get_detected_objects()
            return jsonify({
                'status': 'success',
                'objects': objects
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Detection not running'
            }), 400
            
    except Exception as e:
        logger.error(f"Error getting objects: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to get objects: {str(e)}'
        }), 500

@app.route('/add_obstacle', methods=['POST'])
def add_obstacle():
    """Add a detected obstacle to the map"""
    try:
        data = request.json
        
        # Validate request data
        if not data or 'position' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Invalid request data. Position required.'
            }), 400
            
        # In a real application, you would process the obstacle data
        # Here, we're just returning success
        return jsonify({
            'status': 'success',
            'message': 'Obstacle added successfully'
        })
        
    except Exception as e:
        logger.error(f"Error adding obstacle: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to add obstacle: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'ok',
        'detection_running': detector.is_running if detector else False
    })

@app.route('/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    if detector:
        return jsonify({
            'status': 'success',
            'config': {
                'using_rtsp': detector.rtsp_url is not None,
                'rtsp_url': detector.rtsp_url or 'Not using RTSP',
                'camera_id': detector.camera_id,
                'is_running': detector.is_running
            }
        })
    else:
        return jsonify({
            'status': 'warning',
            'message': 'Detector not initialized',
            'config': {
                'using_rtsp': None,
                'rtsp_url': DEFAULT_RTSP_URL,
                'camera_id': 0,
                'is_running': False
            }
        })

if __name__ == '__main__':
    try:
        port = int(os.environ.get('PORT', 5001))
        app.run(host='0.0.0.0', port=port, debug=True)
    except Exception as e:
        logger.error(f"Error running app: {str(e)}") 