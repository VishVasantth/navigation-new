#!/usr/bin/env python
"""
Run script for the object detection and navigation backend server.
"""
import os
import sys
import logging
from app import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Run the application
if __name__ == '__main__':
    try:
        # Get port from environment or use default
        port = int(os.environ.get('PORT', 5001))
        
        print(f"Starting detection server on port {port}")
        print("Press Ctrl+C to stop the server")
        
        # Run the Flask app
        app.run(host='0.0.0.0', port=port, debug=True, threaded=True)
        
    except KeyboardInterrupt:
        print("Server stopped by user")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Error starting server: {e}")
        sys.exit(1) 