import cv2
import numpy as np
import threading
import time
import logging
import json
import os
import uuid
from pathlib import Path
import subprocess
import signal
import math

# Try to import TensorRT-specific libraries, but have fallbacks for systems without Jetson
try:
    from ultralytics import YOLO
except ImportError:
    logging.warning("Ultralytics YOLO not available, using fallback detection")
    YOLO = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ObjectDetectionService:
    def __init__(self):
        self.is_running = False
        self.detection_thread = None
        self.rtsp_server_process = None
        self.camera_url = None
        self.frame_width = 640
        self.frame_height = 480
        self.detected_objects = []
        self.object_lock = threading.Lock()
        self.latest_frame = None
        self.frame_lock = threading.Lock()
        
        # GPS mapping configuration
        self.gps_enabled = False
        self.current_location = [10.903831, 76.899839]  # Default to Arjuna Statue at Amrita
        self.field_of_view = 60  # Camera field of view in degrees
        self.detection_range = 30  # Maximum detection range in meters
        
        # Set paths
        self.model_path = os.path.join(os.path.dirname(__file__), 'models', 'yolov8n.pt')
        self.rtsp_config_path = os.path.join(os.path.dirname(__file__), 'rtsp-simple-server.yml')
        
        # Ensure model directory exists
        os.makedirs(os.path.join(os.path.dirname(__file__), 'models'), exist_ok=True)
        
        # Download model if it doesn't exist
        if not os.path.exists(self.model_path):
            self._download_model()
        
        # Load the model if available
        self.model = None
        if YOLO is not None:
            try:
                self.model = YOLO(self.model_path)
                logger.info("YOLO model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading YOLO model: {str(e)}")
    
    def _download_model(self):
        """Download the YOLO model if it doesn't exist."""
        try:
            import torch
            from ultralytics.utils.downloads import download
            
            logger.info("Downloading YOLO model...")
            download(
                url="https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt",
                dir=os.path.join(os.path.dirname(__file__), 'models')
            )
            logger.info("Model downloaded successfully")
        except Exception as e:
            logger.error(f"Error downloading model: {str(e)}")
    
    def start_rtsp_server(self):
        """Start the RTSP server using rtsp-simple-server."""
        try:
            # Check if rtsp-simple-server is available
            rtsp_server_path = "rtsp-simple-server"
            self.rtsp_server_process = subprocess.Popen(
                [rtsp_server_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            logger.info("RTSP server started")
            return True
        except Exception as e:
            logger.error(f"Error starting RTSP server: {str(e)}")
            return False
    
    def start(self, camera_url="rtsp://localhost:8554/stream", current_location=None):
        """Start the object detection service."""
        if self.is_running:
            logger.warning("Object detection is already running")
            return True
        
        self.camera_url = camera_url
        
        # Update current location if provided
        if current_location:
            self.current_location = current_location
            self.gps_enabled = True
        
        # Start RTSP server if not already running
        if self.rtsp_server_process is None:
            self.start_rtsp_server()
        
        # Start detection thread
        self.is_running = True
        self.detection_thread = threading.Thread(target=self._detection_loop)
        self.detection_thread.daemon = True
        self.detection_thread.start()
        
        logger.info(f"Object detection started with camera URL: {camera_url}")
        return True
    
    def stop(self):
        """Stop the object detection service."""
        if not self.is_running:
            logger.warning("Object detection is not running")
            return True
        
        self.is_running = False
        
        if self.detection_thread:
            self.detection_thread.join(timeout=1.0)
            self.detection_thread = None
        
        if self.rtsp_server_process:
            self.rtsp_server_process.terminate()
            try:
                self.rtsp_server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.rtsp_server_process.kill()
            self.rtsp_server_process = None
        
        logger.info("Object detection stopped")
        return True
    
    def get_detected_objects(self):
        """Get the latest detected objects."""
        with self.object_lock:
            return self.detected_objects.copy()
    
    def _detection_loop(self):
        """Main detection loop."""
        # Open video capture
        cap = cv2.VideoCapture(self.camera_url)
        if not cap.isOpened():
            logger.error(f"Failed to open video stream: {self.camera_url}")
            self.is_running = False
            return
        
        # Set resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
        
        # Get actual width and height
        actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        logger.info(f"Video stream opened with resolution: {actual_width}x{actual_height}")
        
        while self.is_running:
            try:
                # Read frame
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Failed to read frame, retrying...")
                    time.sleep(0.1)
                    continue
                
                # Store the latest frame for streaming
                with self.frame_lock:
                    self.latest_frame = frame.copy()
                
                # Run object detection
                objects = self._detect_objects(frame)
                
                # Update detected objects
                with self.object_lock:
                    self.detected_objects = objects
                
                # Small delay to prevent CPU overload
                time.sleep(0.01)
            
            except Exception as e:
                logger.error(f"Error in detection loop: {str(e)}")
                time.sleep(0.1)
        
        # Release video capture
        cap.release()
    
    def _detect_objects(self, frame):
        """Detect objects in the frame."""
        objects = []
        
        if self.model is not None:
            # Use YOLO model for detection
            try:
                results = self.model(frame, stream=True, verbose=False)
                
                for result in results:
                    boxes = result.boxes.cpu().numpy()
                    for i, box in enumerate(boxes):
                        x1, y1, x2, y2 = box.xyxy[0].astype(int)
                        confidence = box.conf[0]
                        class_id = int(box.cls[0])
                        class_name = result.names[class_id]
                        
                        # Only include objects with confidence > 0.5
                        if confidence > 0.5:
                            # Calculate center point
                            center_x = int((x1 + x2) / 2)
                            center_y = int((y1 + y2) / 2)
                            
                            # Map the object to GPS coordinates if GPS is enabled
                            gps_position = None
                            if self.gps_enabled:
                                gps_position = self._map_to_gps(center_x, center_y, frame.shape[1], frame.shape[0])
                            
                            # Determine if this is an obstacle based on class
                            is_obstacle = self._is_obstacle_class(class_name)
                            
                            objects.append({
                                "id": str(uuid.uuid4()),
                                "class": class_name,
                                "confidence": float(confidence),
                                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                "center": [center_x, center_y],
                                "position": gps_position,
                                "is_obstacle": is_obstacle,
                                "distance": self._estimate_distance(x2 - x1, class_name) if is_obstacle else None,
                                "timestamp": time.time()
                            })
            
            except Exception as e:
                logger.error(f"Error in YOLO detection: {str(e)}")
        
        else:
            # Fallback detection (simple placeholder)
            objects.append({
                "id": str(uuid.uuid4()),
                "class": "person",
                "confidence": 0.9,
                "bbox": [100, 100, 200, 200],
                "center": [150, 150],
                "position": self.current_location if self.gps_enabled else None,
                "is_obstacle": True,
                "distance": 10,  # 10 meters away
                "timestamp": time.time()
            })
        
        return objects
    
    def _is_obstacle_class(self, class_name):
        """Determine if a detected class should be considered an obstacle."""
        # Define classes that are considered obstacles
        obstacle_classes = [
            'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck', 
            'fire hydrant', 'stop sign', 'bench', 'chair'
        ]
        return class_name.lower() in obstacle_classes
    
    def _estimate_distance(self, width_pixels, class_name):
        """Estimate the distance to an object based on its apparent size."""
        # This is a very simple approximation and would need to be calibrated
        # for specific objects and camera setups in a real application
        
        # Approximate real-world sizes in meters
        real_sizes = {
            'person': 0.5,       # Width of a person
            'bicycle': 0.6,      # Width of a bicycle
            'car': 1.8,          # Width of a car
            'motorcycle': 0.8,   # Width of a motorcycle
            'bus': 2.5,          # Width of a bus
            'truck': 2.5,        # Width of a truck
            'fire hydrant': 0.3, # Width of a fire hydrant
            'stop sign': 0.6,    # Width of a stop sign
            'bench': 1.5,        # Width of a bench
            'chair': 0.5         # Width of a chair
        }
        
        # Default size if class not found
        real_size = real_sizes.get(class_name.lower(), 0.5)
        
        # Simple distance calculation based on apparent size
        focal_length = 800  # Approximate focal length in pixels
        distance = (real_size * focal_length) / width_pixels
        
        return distance
    
    def _map_to_gps(self, pixel_x, pixel_y, frame_width, frame_height):
        """Map a pixel coordinate to a GPS position relative to current location."""
        if not self.gps_enabled or not self.current_location:
            return None
            
        # Calculate relative position from center of frame
        center_x = frame_width / 2
        center_y = frame_height / 2
        
        # Calculate normalized coordinates (-1 to 1) from center
        norm_x = (pixel_x - center_x) / center_x
        norm_y = (pixel_y - center_y) / center_y
        
        # Calculate angle from center based on field of view
        angle_h = norm_x * (self.field_of_view / 2)
        
        # Estimate distance based on vertical position (simple approximation)
        # Objects lower in the frame are typically closer
        distance_factor = 1 - (norm_y * 0.5 + 0.5)  # 0 to 1 (bottom to top)
        distance = self.detection_range * distance_factor
        
        # Convert angle and distance to lat/lng offset
        # This is a very simple approximation that works for small distances
        lat_offset = distance * math.cos(math.radians(angle_h)) / 111000  # 1 degree ~ 111km
        lng_offset = distance * math.sin(math.radians(angle_h)) / (111000 * math.cos(math.radians(self.current_location[0])))
        
        # Calculate new position
        new_lat = self.current_location[0] + lat_offset
        new_lng = self.current_location[1] + lng_offset
        
        return [new_lat, new_lng]
    
    def get_latest_frame(self):
        """Get the latest processed frame with detection visualizations."""
        with self.frame_lock:
            if self.latest_frame is None:
                # Return a black frame if no frame is available
                return np.zeros((self.frame_height, self.frame_width, 3), dtype=np.uint8)
            
            # Make a copy of the latest frame
            frame = self.latest_frame.copy()
        
        # Draw detection boxes
        with self.object_lock:
            for obj in self.detected_objects:
                x1, y1, x2, y2 = obj["bbox"]
                label = f"{obj['class']} ({obj['confidence']:.2f})"
                
                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Draw label
                cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        return frame

    def update_location(self, location):
        """Update the current GPS location of the camera."""
        self.current_location = location
        self.gps_enabled = True
        logger.info(f"Updated current location to: {location}") 