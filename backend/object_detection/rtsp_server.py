import subprocess
import logging
import os
import time
import signal
import threading
import cv2
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

class RtspServer:
    def __init__(self, config_path=None):
        """Initialize the RTSP server.
        
        Args:
            config_path: Path to rtsp-simple-server.yml config file.
                         If None, use default settings.
        """
        self.process = None
        self.config_path = config_path
        self.is_running = False
        self.rtsp_port = 8554
        self.hls_port = 8888
        self.ffmpeg_process = None
        self.stream_thread = None
        self.stop_event = threading.Event()
    
    def start(self):
        """Start the RTSP server."""
        if self.is_running:
            logger.warning("RTSP server is already running")
            return True
        
        try:
            cmd = ["rtsp-simple-server"]
            if self.config_path:
                cmd.append(self.config_path)
            
            logger.info(f"Starting RTSP server with command: {' '.join(cmd)}")
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Wait a bit for server to start
            time.sleep(2)
            
            if self.process.poll() is not None:
                stdout, stderr = self.process.communicate()
                logger.error(f"RTSP server failed to start: {stderr}")
                return False
            
            self.is_running = True
            logger.info(f"RTSP server started on port {self.rtsp_port}")
            return True
        
        except Exception as e:
            logger.error(f"Error starting RTSP server: {str(e)}")
            return False
    
    def stop(self):
        """Stop the RTSP server."""
        if not self.is_running:
            logger.warning("RTSP server is not running")
            return True
        
        try:
            if self.process:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                self.process = None
            
            if self.ffmpeg_process:
                self.ffmpeg_process.terminate()
                try:
                    self.ffmpeg_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.ffmpeg_process.kill()
                self.ffmpeg_process = None
            
            if self.stream_thread and self.stream_thread.is_alive():
                self.stop_event.set()
                self.stream_thread.join(timeout=5)
                self.stream_thread = None
            
            self.is_running = False
            logger.info("RTSP server stopped")
            return True
        
        except Exception as e:
            logger.error(f"Error stopping RTSP server: {str(e)}")
            return False
    
    def create_stream_from_camera(self, camera_url, stream_name="stream"):
        """Create a stream from a camera to the RTSP server.
        
        Args:
            camera_url: URL of the camera (can be local device like 0 or rtsp:// URL)
            stream_name: Name of the stream to create
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.is_running:
            logger.warning("RTSP server is not running, starting it now")
            if not self.start():
                return False
        
        try:
            # Convert camera_url to int if it's a digit string (for local cameras)
            if isinstance(camera_url, str) and camera_url.isdigit():
                camera_url = int(camera_url)
            
            # Stop any existing FFmpeg process
            if self.ffmpeg_process:
                self.ffmpeg_process.terminate()
                try:
                    self.ffmpeg_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.ffmpeg_process.kill()
                self.ffmpeg_process = None
            
            # Start FFmpeg to stream from camera to RTSP server
            cmd = [
                "ffmpeg",
                "-f", "v4l2",
                "-i", str(camera_url),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-f", "rtsp",
                f"rtsp://localhost:{self.rtsp_port}/{stream_name}"
            ]
            
            logger.info(f"Starting FFmpeg with command: {' '.join(cmd)}")
            self.ffmpeg_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait a bit for FFmpeg to start
            time.sleep(2)
            
            if self.ffmpeg_process.poll() is not None:
                stdout, stderr = self.ffmpeg_process.communicate()
                logger.error(f"FFmpeg failed to start: {stderr}")
                return False
            
            logger.info(f"Stream created: rtsp://localhost:{self.rtsp_port}/{stream_name}")
            return True
        
        except Exception as e:
            logger.error(f"Error creating stream: {str(e)}")
            return False
    
    def stream_frames_to_rtsp(self, frame_source, stream_name="processed", fps=30):
        """Stream frames to RTSP server using OpenCV.
        
        Args:
            frame_source: Function that returns the next frame to stream
            stream_name: Name of the stream to create
            fps: Frames per second
        
        Returns:
            bool: True if streaming started, False otherwise
        """
        if not self.is_running:
            logger.warning("RTSP server is not running, starting it now")
            if not self.start():
                return False
        
        # Stop any existing stream thread
        if self.stream_thread and self.stream_thread.is_alive():
            self.stop_event.set()
            self.stream_thread.join(timeout=5)
            self.stream_thread = None
            self.stop_event.clear()
        
        # Start a new thread to stream frames
        self.stream_thread = threading.Thread(
            target=self._frame_streaming_thread,
            args=(frame_source, stream_name, fps)
        )
        self.stream_thread.daemon = True
        self.stream_thread.start()
        
        logger.info(f"Frame streaming started to rtsp://localhost:{self.rtsp_port}/{stream_name}")
        return True
    
    def _frame_streaming_thread(self, frame_source, stream_name, fps):
        """Thread function to stream frames to RTSP server."""
        try:
            # Set up FFmpeg process to receive frames and send to RTSP server
            ffmpeg_cmd = [
                "ffmpeg",
                "-f", "rawvideo",
                "-pix_fmt", "bgr24",
                "-s", "640x480",  # Default size, should match frame size
                "-r", str(fps),
                "-i", "pipe:0",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-f", "rtsp",
                f"rtsp://localhost:{self.rtsp_port}/{stream_name}"
            ]
            
            process = subprocess.Popen(
                ffmpeg_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Stream frames until stopped
            frame_interval = 1.0 / fps
            last_frame_time = time.time()
            
            while not self.stop_event.is_set():
                frame = frame_source()
                
                if frame is None:
                    time.sleep(0.1)
                    continue
                
                # Ensure frame is the right size and format
                if frame.shape[0] != 480 or frame.shape[1] != 640:
                    frame = cv2.resize(frame, (640, 480))
                
                # Write frame to FFmpeg
                process.stdin.write(frame.tobytes())
                
                # Control frame rate
                current_time = time.time()
                elapsed = current_time - last_frame_time
                sleep_time = max(0, frame_interval - elapsed)
                if sleep_time > 0:
                    time.sleep(sleep_time)
                last_frame_time = time.time()
            
            # Clean up
            process.stdin.close()
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
        except Exception as e:
            logger.error(f"Error in frame streaming thread: {str(e)}")
        
        logger.info("Frame streaming thread stopped")
    
    def create_hls_stream(self, rtsp_url, hls_dir="hls"):
        """Create an HLS stream from an RTSP stream.
        
        Args:
            rtsp_url: RTSP URL to stream from
            hls_dir: Directory to store HLS segments
        
        Returns:
            str: URL of the HLS stream if successful, None otherwise
        """
        try:
            # Ensure HLS directory exists
            os.makedirs(hls_dir, exist_ok=True)
            
            # Stop any existing FFmpeg process for HLS
            if self.ffmpeg_process:
                self.ffmpeg_process.terminate()
                try:
                    self.ffmpeg_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.ffmpeg_process.kill()
                self.ffmpeg_process = None
            
            # Start FFmpeg to create HLS stream
            cmd = [
                "ffmpeg",
                "-i", rtsp_url,
                "-c:v", "copy",
                "-hls_time", "2",
                "-hls_list_size", "5",
                "-hls_flags", "delete_segments",
                "-hls_segment_type", "mpegts",
                f"{hls_dir}/comeback.m3u8"
            ]
            
            logger.info(f"Starting HLS conversion with command: {' '.join(cmd)}")
            self.ffmpeg_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait a bit for FFmpeg to start
            time.sleep(2)
            
            if self.ffmpeg_process.poll() is not None:
                stdout, stderr = self.ffmpeg_process.communicate()
                logger.error(f"HLS conversion failed to start: {stderr}")
                return None
            
            hls_url = f"http://localhost:{self.hls_port}/hls/comeback.m3u8"
            logger.info(f"HLS stream created: {hls_url}")
            return hls_url
        
        except Exception as e:
            logger.error(f"Error creating HLS stream: {str(e)}")
            return None 