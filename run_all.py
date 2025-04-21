#!/usr/bin/env python
"""
Script to start both the frontend and backend servers together.
"""
import os
import sys
import time
import subprocess
import signal
import platform

# Determine the operating system
is_windows = platform.system() == "Windows"

# Store process references
frontend_process = None
backend_process = None

# ANSI color codes for output (doesn't work on Windows cmd)
if is_windows:
    # Windows doesn't support ANSI colors in cmd by default
    GREEN = ""
    YELLOW = ""
    RED = ""
    RESET = ""
else:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    RESET = "\033[0m"

def print_colored(message, color):
    """Print colored text if supported"""
    print(f"{color}{message}{RESET}")

def clean_up():
    """Terminate all processes on exit"""
    print_colored("\nShutting down services...", YELLOW)
    
    if backend_process:
        print_colored("Stopping backend server...", YELLOW)
        if is_windows:
            # Windows requires different handling
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(backend_process.pid)])
        else:
            # Unix-like systems
            backend_process.terminate()
            try:
                backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                backend_process.kill()
    
    if frontend_process:
        print_colored("Stopping frontend server...", YELLOW)
        if is_windows:
            # Windows requires different handling
            subprocess.call(['taskkill', '/F', '/T', '/PID', str(frontend_process.pid)])
        else:
            # Unix-like systems
            frontend_process.terminate()
            try:
                frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_process.kill()
    
    print_colored("All services stopped.", GREEN)

def signal_handler(sig, frame):
    """Handle interrupt signals"""
    print_colored("\nInterrupt received, shutting down...", YELLOW)
    clean_up()
    sys.exit(0)

def start_backend():
    """Start the backend detection server"""
    global backend_process
    
    print_colored("Starting backend server...", YELLOW)
    
    # Set up the command based on operating system
    if is_windows:
        # Use pythonw.exe to avoid opening a new console window
        cmd = ["python", "backend/run.py"]
    else:
        cmd = ["python3", "backend/run.py"]
    
    try:
        # Start the backend process
        backend_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        print_colored("Backend server started on http://localhost:5001", GREEN)
        
        # Start a non-blocking read loop for backend output
        def read_backend_output():
            for line in backend_process.stdout:
                print(f"{YELLOW}[Backend] {line.strip()}{RESET}")
        
        import threading
        backend_thread = threading.Thread(target=read_backend_output)
        backend_thread.daemon = True
        backend_thread.start()
        
        # Wait to ensure backend is ready
        time.sleep(2)
        
        return True
    except Exception as e:
        print_colored(f"Error starting backend: {str(e)}", RED)
        return False

def start_frontend():
    """Start the React frontend server"""
    global frontend_process
    
    print_colored("Starting frontend server...", YELLOW)
    
    # Determine the npm command based on operating system
    npm_cmd = "npm.cmd" if is_windows else "npm"
    
    try:
        # Start the frontend process
        frontend_process = subprocess.Popen(
            [npm_cmd, "start"],
            cwd="frontend",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        print_colored("Frontend server starting...", GREEN)
        
        # Start a non-blocking read loop for frontend output
        def read_frontend_output():
            for line in frontend_process.stdout:
                if "Compiled" in line:
                    print_colored(f"[Frontend] {line.strip()}", GREEN)
                    print_colored("Frontend is ready at http://localhost:3000", GREEN)
                else:
                    print(f"{GREEN}[Frontend] {line.strip()}{RESET}")
        
        import threading
        frontend_thread = threading.Thread(target=read_frontend_output)
        frontend_thread.daemon = True
        frontend_thread.start()
        
        return True
    except Exception as e:
        print_colored(f"Error starting frontend: {str(e)}", RED)
        return False

if __name__ == "__main__":
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Print banner
        print_colored("\n=======================================", GREEN)
        print_colored(" OSM Navigation with Object Detection", GREEN)
        print_colored("=======================================\n", GREEN)
        
        # Make sure we're in the right directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(script_dir)
        
        # Start services
        if start_backend():
            if start_frontend():
                print_colored("\nAll services are running!", GREEN)
                print_colored("Open http://localhost:3000 in your browser", GREEN)
                print_colored("Press Ctrl+C to stop all services\n", YELLOW)
                
                # Keep script running until interrupted
                while True:
                    time.sleep(1)
            else:
                print_colored("Failed to start frontend, stopping all services", RED)
                clean_up()
                sys.exit(1)
        else:
            print_colored("Failed to start backend, stopping all services", RED)
            clean_up()
            sys.exit(1)
    except KeyboardInterrupt:
        print_colored("\nShutting down services by user request...", YELLOW)
        clean_up()
    except Exception as e:
        print_colored(f"\nUnexpected error: {str(e)}", RED)
        clean_up()
        sys.exit(1) 