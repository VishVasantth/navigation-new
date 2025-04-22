// WebSocket service for ESP32 communication
let ws = null;
let isConnected = false;
let reconnectInterval = null;
const listeners = [];

// Initialize WebSocket connection
export const initWebSocket = (url = 'ws://192.168.4.1:81') => {
  if (ws) {
    ws.close();
  }

  try {
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      isConnected = true;
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      // Notify all listeners that connection is established
      listeners.forEach(listener => {
        if (listener.onOpen) listener.onOpen();
      });
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      
      // Attempt to reconnect
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('Attempting to reconnect WebSocket...');
          initWebSocket(url);
        }, 5000); // Try to reconnect every 5 seconds
      }
      
      // Notify all listeners
      listeners.forEach(listener => {
        if (listener.onClose) listener.onClose();
      });
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Notify all listeners
      listeners.forEach(listener => {
        if (listener.onError) listener.onError(error);
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received message from ESP32:', message);
        
        // Notify all listeners
        listeners.forEach(listener => {
          if (listener.onMessage) listener.onMessage(message);
        });
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    return true;
  } catch (error) {
    console.error('Failed to establish WebSocket connection:', error);
    return false;
  }
};

// Check if WebSocket is connected
export const isWebSocketConnected = () => isConnected;

// Send navigation instructions to ESP32
export const sendNavigationInstruction = (instruction) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    return false;
  }
  
  try {
    ws.send(JSON.stringify(instruction));
    return true;
  } catch (error) {
    console.error('Error sending navigation instruction:', error);
    return false;
  }
};

// Format turning instruction for ESP32
export const formatTurningInstruction = (distance, direction, speed = 50) => {
  // Create a standardized message format that ESP32 can parse
  return {
    type: 'navigation',
    distance: Math.round(distance), // Distance in meters
    direction: direction.toLowerCase(), // 'left', 'right', or 'straight'
    speed: speed // Speed percentage (0-100)
  };
};

// Format immediate motor control commands
export const sendMotorCommand = (leftSpeed, rightSpeed, duration = 0) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    return false;
  }
  
  const command = {
    type: 'motor',
    left: leftSpeed,  // -100 to 100 (negative = reverse)
    right: rightSpeed, // -100 to 100 (negative = reverse)
    duration: duration // Duration in milliseconds, 0 = indefinite
  };
  
  try {
    ws.send(JSON.stringify(command));
    return true;
  } catch (error) {
    console.error('Error sending motor command:', error);
    return false;
  }
};

// Add listener for WebSocket events
export const addWebSocketListener = (listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
};

// Helper functions for common commands
export const stopMotors = () => sendMotorCommand(0, 0, 0);
export const turnLeft = (speed = 40, duration = 500) => sendMotorCommand(-speed, speed, duration);
export const turnRight = (speed = 40, duration = 500) => sendMotorCommand(speed, -speed, duration);
export const moveForward = (speed = 50) => sendMotorCommand(speed, speed, 0);
export const moveBackward = (speed = 50) => sendMotorCommand(-speed, -speed, 0); 