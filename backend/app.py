from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
import os
import logging
import threading
import time
import io
import cv2

# Import services
from object_detection.detection_service import ObjectDetectionService
from osm_server.osm_service import OSMService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize the Flask application
app = Flask(__name__)
CORS(app)

# Initialize services
detection_service = ObjectDetectionService()
osm_service = OSMService()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the server is running."""
    return jsonify({"status": "ok", "message": "Backend server is running"}), 200

# Object Detection Routes
@app.route('/detection/start', methods=['POST'])
def start_detection():
    """Start the object detection service."""
    try:
        data = request.json
        camera_url = data.get('camera_url', 'rtsp://localhost:8554/stream')
        
        success = detection_service.start(camera_url)
        if success:
            return jsonify({"status": "success", "message": "Object detection started"}), 200
        else:
            return jsonify({"status": "error", "message": "Failed to start object detection"}), 500
    except Exception as e:
        logger.error(f"Error starting detection: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/detection/stop', methods=['POST'])
def stop_detection():
    """Stop the object detection service."""
    try:
        success = detection_service.stop()
        if success:
            return jsonify({"status": "success", "message": "Object detection stopped"}), 200
        else:
            return jsonify({"status": "error", "message": "Failed to stop object detection"}), 500
    except Exception as e:
        logger.error(f"Error stopping detection: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/detection/objects', methods=['GET'])
def get_detected_objects():
    """Get the latest detected objects."""
    try:
        objects = detection_service.get_detected_objects()
        return jsonify({"status": "success", "objects": objects}), 200
    except Exception as e:
        logger.error(f"Error getting detected objects: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/detection/obstacles', methods=['GET'])
def get_detected_obstacles():
    """Get only the detected objects that are classified as obstacles with location data."""
    try:
        all_objects = detection_service.get_detected_objects()
        obstacles = [obj for obj in all_objects if obj.get('is_obstacle', False) and obj.get('position')]
        
        # Format obstacles for the frontend
        formatted_obstacles = []
        for obstacle in obstacles:
            formatted_obstacles.append({
                "id": obstacle["id"],
                "position": obstacle["position"],
                "class": obstacle["class"],
                "confidence": obstacle["confidence"],
                "radius": 5,  # Default radius of 5 meters for all obstacles
                "distance": obstacle.get("distance", 10)
            })
        
        return jsonify({
            "status": "success", 
            "obstacles": formatted_obstacles,
            "count": len(formatted_obstacles)
        }), 200
    except Exception as e:
        logger.error(f"Error getting detected obstacles: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/detection/update-location', methods=['POST'])
def update_location():
    """Update the current location of the camera/robot for obstacle mapping."""
    try:
        data = request.json
        if not data or 'location' not in data:
            return jsonify({"status": "error", "message": "Location data is required"}), 400
        
        location = data['location']
        if not isinstance(location, list) or len(location) != 2:
            return jsonify({"status": "error", "message": "Location must be [latitude, longitude]"}), 400
        
        detection_service.update_location(location)
        return jsonify({"status": "success", "message": "Location updated", "location": location}), 200
    except Exception as e:
        logger.error(f"Error updating location: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/detection/frame', methods=['GET'])
def get_detection_frame():
    """Get the latest processed frame with detection visualizations."""
    try:
        frame = detection_service.get_latest_frame()
        _, buffer = cv2.imencode('.jpg', frame)
        response = send_file(
            io.BytesIO(buffer),
            mimetype='image/jpeg'
        )
        return response
    except Exception as e:
        logger.error(f"Error getting detection frame: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# OSM Routes
@app.route('/osm/route', methods=['POST'])
def get_route():
    """Get a route between two points."""
    try:
        data = request.json
        start = data.get('start')
        end = data.get('end')
        waypoints = data.get('waypoints', [])
        
        if not start or not end:
            return jsonify({"status": "error", "message": "Start and end points are required"}), 400
        
        route = osm_service.get_route(start, end, waypoints)
        return jsonify({"status": "success", "route": route}), 200
    except Exception as e:
        logger.error(f"Error getting route: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/osm/obstacles', methods=['GET'])
def get_obstacles():
    """Get all recorded obstacles."""
    try:
        obstacles = osm_service.get_obstacles()
        return jsonify({"status": "success", "obstacles": obstacles}), 200
    except Exception as e:
        logger.error(f"Error getting obstacles: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/osm/obstacles', methods=['POST'])
def add_obstacle():
    """Add a new obstacle."""
    try:
        data = request.json
        position = data.get('position')
        size = data.get('size', 1.0)
        
        if not position:
            return jsonify({"status": "error", "message": "Position is required"}), 400
        
        obstacle_id = osm_service.add_obstacle(position, size)
        return jsonify({"status": "success", "obstacle_id": obstacle_id}), 201
    except Exception as e:
        logger.error(f"Error adding obstacle: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/osm/obstacles/<obstacle_id>', methods=['DELETE'])
def remove_obstacle(obstacle_id):
    """Remove an obstacle by ID."""
    try:
        success = osm_service.remove_obstacle(obstacle_id)
        if success:
            return jsonify({"status": "success", "message": f"Obstacle {obstacle_id} removed"}), 200
        else:
            return jsonify({"status": "error", "message": f"Obstacle {obstacle_id} not found"}), 404
    except Exception as e:
        logger.error(f"Error removing obstacle: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/osm/obstacles/clear', methods=['POST'])
def clear_obstacles():
    """Clear all obstacles."""
    try:
        osm_service.clear_obstacles()
        return jsonify({"status": "success", "message": "All obstacles cleared"}), 200
    except Exception as e:
        logger.error(f"Error clearing obstacles: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/osm/reroute', methods=['POST'])
def reroute():
    """Reroute based on current position and obstacles."""
    try:
        data = request.json
        current_position = data.get('current_position')
        destination = data.get('destination')
        
        if not current_position or not destination:
            return jsonify({"status": "error", "message": "Current position and destination are required"}), 400
        
        new_route = osm_service.reroute(current_position, destination)
        return jsonify({"status": "success", "route": new_route}), 200
    except Exception as e:
        logger.error(f"Error rerouting: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 