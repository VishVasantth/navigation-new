import cv2
import time
import threading
import logging
import numpy as np
from io import BytesIO
from ultralytics import YOLO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ObjectDetector:
    """
    A class to handle object detection using YOLOv8 on video frames.
    The detection runs in a separate thread and results are available via methods.
    """
    
    def __init__(self, model_path, camera_id=0, rtsp_url=None, confidence_threshold=0.5, obstacle_classes=None):
        """
        Initialize the object detector.
        
        Args:
            model_path (str): Path to the YOLOv8 model weights
            camera_id (int): Camera device ID (default: 0 for default camera) - used only if rtsp_url is None
            rtsp_url (str): URL for RTSP stream (e.g. rtsp://username:password@ip_address:port/stream)
            confidence_threshold (float): Minimum confidence for detection (0-1)
            obstacle_classes (list): Classes to be considered as obstacles (default: person, car, truck, etc.)
        """
        self.model_path = model_path
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url
        self.confidence_threshold = confidence_threshold
        
        # Default obstacle classes - can be customized
        self.obstacle_classes = obstacle_classes or [
            'person', 'bicycle', 'car', 'motorcycle', 'bus', 
            'truck', 'dog', 'chair', 'bench'
        ]
        
        # Internal state
        self.is_running = False
        self.thread = None
        self.cap = None
        self.model = None
        self.connection_attempts = 0
        self.max_connection_attempts = 5
        
        # Shared data (protected by lock)
        self.lock = threading.Lock()
        self.current_frame = None
        self.detected_objects = []
        
        # Load YOLO model
        try:
            logger.info(f"Loading YOLO model from {model_path}")
            self.model = YOLO(model_path)
            logger.info("YOLO model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {str(e)}")
            raise
    
    def start(self):
        """Start the detection thread"""
        if self.is_running:
            logger.warning("Detection already running")
            return False
        
        try:
            # Initialize camera
            if not self.initialize_camera():
                logger.error("Failed to initialize camera")
                if self.rtsp_url:
                    raise ValueError(f"Could not connect to RTSP stream: {self.rtsp_url}")
                else:
                    raise ValueError(f"Could not open camera {self.camera_id}")
            
            # Start thread
            self.is_running = True
            self.connection_attempts = 0
            self.thread = threading.Thread(target=self._detection_loop)
            self.thread.daemon = True
            self.thread.start()
            logger.info("Detection started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error starting detection: {str(e)}")
            self.is_running = False
            if self.cap:
                self.cap.release()
                self.cap = None
            raise
    
    def stop(self):
        """Stop the detection thread"""
        self.is_running = False
        
        if self.thread:
            self.thread.join(timeout=5.0)
            self.thread = None
        
        if self.cap:
            self.cap.release()
            self.cap = None
            
        with self.lock:
            self.current_frame = None
            self.detected_objects = []
            
        logger.info("Detection stopped")
        return True
        
    def initialize_camera(self):
        """Initialize the camera/video capture object"""
        if self.cap is not None and self.cap.isOpened():
            # Camera is already initialized
            return True
        
        try:
            # Determine source - RTSP URL or webcam
            if self.rtsp_url:
                logger.info(f"Initializing camera from RTSP stream: {self.rtsp_url}")
                # Configure OpenCV for RTSP streams
                self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
                
                # Set RTSP buffer size and other relevant parameters
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)  # Small buffer to reduce latency
                
                # Try to set lower resolution for better performance
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            else:
                logger.info(f"Initializing camera with ID: {self.camera_id}")
                self.cap = cv2.VideoCapture(self.camera_id)
                
                # Try to set resolution for webcam
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
            if not self.cap.isOpened():
                logger.error(f"Failed to open video source")
                return False
            
            return True
        
        except Exception as e:
            logger.error(f"Error initializing camera: {str(e)}")
            if self.cap:
                self.cap.release()
                self.cap = None
            return False
    
    def _detection_loop(self):
        """Main detection loop that runs in a separate thread"""
        logger.info("Detection loop started")
        
        # For simulating GPS locations - in a real system these would come from sensors
        # These are fixed coordinates from the map for testing
        base_lat = 10.903831  # Near Arjuna Statue at Amrita
        base_lon = 76.899839
        
        frame_count = 0
        start_time = time.time()
        connection_retry_delay = 2.0  # Seconds to wait between reconnection attempts
        last_frame_time = time.time()
        
        while self.is_running:
            try:
                # Check if we need to reconnect to the stream
                current_time = time.time()
                if self.rtsp_url and (current_time - last_frame_time) > 5.0:  # No frames for 5 seconds
                    logger.warning("No frames received for 5 seconds, attempting to reconnect")
                    
                    # Increment attempts counter
                    self.connection_attempts += 1
                    
                    # Check if we've reached max attempts
                    if self.connection_attempts >= self.max_connection_attempts:
                        logger.error(f"Failed to reconnect after {self.max_connection_attempts} attempts")
                        self.is_running = False
                        break
                    
                    # Release old capture and create a new one
                    if self.cap:
                        self.cap.release()
                    
                    logger.info(f"Reconnecting to RTSP stream (attempt {self.connection_attempts})...")
                    self.cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
                    
                    # Reset timer
                    last_frame_time = current_time
                    time.sleep(connection_retry_delay)
                    continue
                
                # Capture frame
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    logger.warning("Failed to capture frame")
                    # Sleep briefly to avoid tight loop if camera is not working
                    time.sleep(0.1)
                    continue
                
                # Update frame timestamp
                last_frame_time = time.time()
                
                # Reset connection attempts counter on successful frame
                self.connection_attempts = 0
                
                # Process frame with YOLO model (every 3 frames to improve performance)
                frame_count += 1
                if frame_count % 3 == 0:
                    # Get detections
                    results = self.model(frame)
                    
                    # Process results and update detected objects
                    objects = []
                    
                    for result in results:
                        for i, (box, score, class_id) in enumerate(zip(result.boxes.xyxy, 
                                                                   result.boxes.conf, 
                                                                   result.boxes.cls)):
                            if score >= self.confidence_threshold:
                                # Extract coordinates
                                x1, y1, x2, y2 = box.cpu().numpy().astype(int)
                                class_name = result.names[int(class_id)]
                                
                                # Calculate center of detection
                                center_x = (x1 + x2) / 2
                                center_y = (y1 + y2) / 2
                                
                                # Normalize to [0,1] range
                                norm_x = center_x / frame.shape[1]
                                norm_y = center_y / frame.shape[0]
                                
                                # Simulate GPS coordinates based on position in frame
                                # Just an example - in a real system these would come from sensors
                                # Adjust these offsets based on your specific map and camera setup
                                lat_offset = (0.5 - norm_y) * 0.002  # Adjust as needed
                                lon_offset = (norm_x - 0.5) * 0.002  # Adjust as needed
                                
                                latitude = base_lat + lat_offset
                                longitude = base_lon + lon_offset
                                
                                # Calculate size/radius based on bounding box size
                                # This is a simple approximation - should be calibrated in a real system
                                width = (x2 - x1)
                                height = (y2 - y1)
                                size = (width + height) / 4  # Quarter of average dimension
                                
                                # Convert size to approximate meters based on image proportion
                                # This is a very rough approximation and should be calibrated
                                size_meters = max(3, size / 20)
                                
                                # Check if this class is considered an obstacle
                                is_obstacle = class_name.lower() in self.obstacle_classes
                                
                                # Create an object entry
                                obj = {
                                    'id': i,
                                    'class': class_name,
                                    'confidence': float(score),
                                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                                    'position': [float(latitude), float(longitude)],
                                    'is_obstacle': is_obstacle,
                                    'radius': float(size_meters)
                                }
                                objects.append(obj)
                                
                                # Draw detection on frame
                                color = (0, 0, 255) if is_obstacle else (0, 255, 0)
                                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                                cv2.putText(frame, f"{class_name} {score:.2f}", 
                                            (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 
                                            0.5, color, 2)
                    
                    # Update shared state with lock
                    with self.lock:
                        self.detected_objects = objects
                
                # Draw frame counter
                elapsed_time = time.time() - start_time
                fps = frame_count / elapsed_time if elapsed_time > 0 else 0
                cv2.putText(frame, f"FPS: {fps:.1f}", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # Add RTSP stream info if using RTSP
                if self.rtsp_url:
                    cv2.putText(frame, "RTSP Stream", (10, 60),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                # Update current frame with lock
                with self.lock:
                    self.current_frame = frame.copy()
                
            except Exception as e:
                logger.error(f"Error in detection loop: {str(e)}")
                # Sleep briefly to avoid tight loop if there's an error
                time.sleep(0.5)
                
        logger.info("Detection loop ended")
    
    def get_frame_jpg(self, detect=True):
        """Get the current frame as JPEG bytes"""
        with self.lock:
            # If detection is running, return the current processed frame
            if detect and self.current_frame is not None:
                frame = self.current_frame.copy()
            else:
                # Capture a single frame from the camera
                if not hasattr(self, 'cap') or self.cap is None:
                    self.initialize_camera()
                    
                if not self.cap.isOpened():
                    logger.error("Camera is not open")
                    return None
                    
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("Failed to capture frame")
                    return None
        
        # Convert frame to JPEG
        ret, jpeg = cv2.imencode('.jpg', frame)
        if not ret:
            return None
            
        return jpeg.tobytes()
    
    def get_detected_objects(self):
        """Get the detected objects from the latest processed frame"""
        with self.lock:
            return self.detected_objects.copy()

# Demo code - only runs if this file is executed directly
if __name__ == "__main__":
    import os
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Run YOLO object detection on video source')
    parser.add_argument('--rtsp', type=str, help='RTSP stream URL')
    parser.add_argument('--camera', type=int, default=0, help='Camera device ID (default: 0)')
    args = parser.parse_args()
    
    # Find model path
    model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'yolov8n.pt')
    
    # Create detector with appropriate source
    if args.rtsp:
        print(f"Using RTSP stream: {args.rtsp}")
        detector = ObjectDetector(model_path=model_path, rtsp_url=args.rtsp)
    else:
        print(f"Using camera ID: {args.camera}")
        detector = ObjectDetector(model_path=model_path, camera_id=args.camera)
    
    # Start detection
    detector.start()
    
    try:
        # Display frames and detections in a loop
        while True:
            frame_jpg = detector.get_frame_jpg()
            if frame_jpg:
                # Convert JPEG to numpy array
                arr = np.frombuffer(frame_jpg, np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                
                # Display frame
                cv2.imshow('Object Detection', frame)
                
                # Print objects
                objects = detector.get_detected_objects()
                if objects:
                    os.system('cls' if os.name == 'nt' else 'clear')
                    print(f"Detected {len(objects)} objects:")
                    for obj in objects:
                        print(f"{obj['class']} ({obj['confidence']:.2f}) at position {obj['position']}")
            
            # Break loop if 'q' is pressed
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
            # Sleep to control refresh rate
            time.sleep(0.05)
            
    except KeyboardInterrupt:
        print("Interrupted by user")
    finally:
        # Clean up
        detector.stop()
        cv2.destroyAllWindows() 