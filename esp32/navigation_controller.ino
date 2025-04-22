#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// WiFi credentials - replace with your network details or create an access point
const char* ssid = "ESP32-Navigation";  // WiFi network name
const char* password = "password123";   // WiFi password

// Motor control pins
#define LEFT_MOTOR_PIN1 16  // GPIO pins for L298N or similar motor driver
#define LEFT_MOTOR_PIN2 17
#define RIGHT_MOTOR_PIN1 18
#define RIGHT_MOTOR_PIN2 19
#define LEFT_MOTOR_EN 21   // PWM enable pins
#define RIGHT_MOTOR_EN 22

// PWM properties
#define PWM_FREQ 1000
#define PWM_RESOLUTION 8
#define LEFT_MOTOR_CHANNEL 0
#define RIGHT_MOTOR_CHANNEL 1

// WebSocket server on port 81
WebSocketsServer webSocket = WebSocketsServer(81);

// Navigation state
float remainingDistance = 0;
String nextDirection = "straight";
int motorSpeed = 50;
unsigned long lastDistanceUpdate = 0;
float distanceUpdateInterval = 500; // milliseconds
float speedFactor = 1.0; // Adjust for motor calibration

// Function declarations
void setupMotors();
void handleMotorControl(int leftSpeed, int rightSpeed, int duration);
void handleNavigation(float distance, String direction, int speed);
void updateRemainingDistance();
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length);

void setup() {
  Serial.begin(115200);
  
  // Setup motor control pins
  setupMotors();
  
  // Setup WiFi Access Point
  WiFi.softAP(ssid, password);
  Serial.println("Access Point Started");
  Serial.print("IP Address: ");
  Serial.println(WiFi.softAPIP());

  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.println("WebSocket server started");
}

void loop() {
  webSocket.loop();
  
  // Update distance calculations based on time elapsed
  if (remainingDistance > 0) {
    updateRemainingDistance();
  }
}

// Configure motor control pins and PWM
void setupMotors() {
  // Set all motor control pins as outputs
  pinMode(LEFT_MOTOR_PIN1, OUTPUT);
  pinMode(LEFT_MOTOR_PIN2, OUTPUT);
  pinMode(RIGHT_MOTOR_PIN1, OUTPUT);
  pinMode(RIGHT_MOTOR_PIN2, OUTPUT);
  
  // Configure PWM for motor speed control
  ledcSetup(LEFT_MOTOR_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(RIGHT_MOTOR_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  
  // Attach PWM channels to enable pins
  ledcAttachPin(LEFT_MOTOR_EN, LEFT_MOTOR_CHANNEL);
  ledcAttachPin(RIGHT_MOTOR_EN, RIGHT_MOTOR_CHANNEL);
  
  // Initial state - motors stopped
  digitalWrite(LEFT_MOTOR_PIN1, LOW);
  digitalWrite(LEFT_MOTOR_PIN2, LOW);
  digitalWrite(RIGHT_MOTOR_PIN1, LOW);
  digitalWrite(RIGHT_MOTOR_PIN2, LOW);
  ledcWrite(LEFT_MOTOR_CHANNEL, 0);
  ledcWrite(RIGHT_MOTOR_CHANNEL, 0);
}

// Handle motor control commands
void handleMotorControl(int leftSpeed, int rightSpeed, int duration) {
  // Constrain speed values
  leftSpeed = constrain(leftSpeed, -100, 100);
  rightSpeed = constrain(rightSpeed, -100, 100);
  
  // Map speed from percentage to PWM value (0-255)
  int leftPWM = map(abs(leftSpeed), 0, 100, 0, 255);
  int rightPWM = map(abs(rightSpeed), 0, 100, 0, 255);

  // Set motor directions based on speed sign
  if (leftSpeed >= 0) {
    digitalWrite(LEFT_MOTOR_PIN1, HIGH);
    digitalWrite(LEFT_MOTOR_PIN2, LOW);
  } else {
    digitalWrite(LEFT_MOTOR_PIN1, LOW);
    digitalWrite(LEFT_MOTOR_PIN2, HIGH);
  }
  
  if (rightSpeed >= 0) {
    digitalWrite(RIGHT_MOTOR_PIN1, HIGH);
    digitalWrite(RIGHT_MOTOR_PIN2, LOW);
  } else {
    digitalWrite(RIGHT_MOTOR_PIN1, LOW);
    digitalWrite(RIGHT_MOTOR_PIN2, HIGH);
  }
  
  // Apply PWM speed
  ledcWrite(LEFT_MOTOR_CHANNEL, leftPWM);
  ledcWrite(RIGHT_MOTOR_CHANNEL, rightPWM);
  
  // Handle timed commands
  if (duration > 0) {
    delay(duration);
    // Stop motors after duration
    ledcWrite(LEFT_MOTOR_CHANNEL, 0);
    ledcWrite(RIGHT_MOTOR_CHANNEL, 0);
  }
}

// Process navigation commands
void handleNavigation(float distance, String direction, int speed) {
  // Set the navigation parameters
  remainingDistance = distance;
  nextDirection = direction;
  motorSpeed = speed;
  
  Serial.print("New navigation: ");
  Serial.print(distance);
  Serial.print("m, direction: ");
  Serial.println(direction);
  
  // Reset the last distance update time
  lastDistanceUpdate = millis();
  
  // Handle immediate actions based on direction
  if (direction == "stop") {
    handleMotorControl(0, 0, 0);
    remainingDistance = 0;
  } else if (distance == 0) {
    // Handle immediate turn commands without a distance
    if (direction == "left") {
      handleMotorControl(-speed/2, speed/2, 500); // Turn left
    } else if (direction == "right") {
      handleMotorControl(speed/2, -speed/2, 500); // Turn right
    } else if (direction == "slight_left") {
      handleMotorControl(speed/4, speed/2, 500); // Slight left
    } else if (direction == "slight_right") {
      handleMotorControl(speed/2, speed/4, 500); // Slight right
    } else if (direction == "sharp_left") {
      handleMotorControl(-speed*0.7, speed*0.7, 700); // Sharp left
    } else if (direction == "sharp_right") {
      handleMotorControl(speed*0.7, -speed*0.7, 700); // Sharp right
    } else if (direction == "u_turn") {
      handleMotorControl(-speed, speed, 1500); // U-turn
    } else {
      handleMotorControl(speed, speed, 0); // Go straight
    }
  } else {
    // Start moving forward until we reach the specified distance
    handleMotorControl(speed, speed, 0);
  }
}

// Update the remaining distance based on time and speed
void updateRemainingDistance() {
  unsigned long currentTime = millis();
  unsigned long elapsedMs = currentTime - lastDistanceUpdate;
  
  if (elapsedMs >= distanceUpdateInterval) {
    // Calculate distance traveled based on time and speed
    // This is a simplified model - in a real robot you'd use encoders
    float distanceTraveled = (motorSpeed / 100.0) * speedFactor * (elapsedMs / 1000.0);
    remainingDistance -= distanceTraveled;
    
    // Update the last update time
    lastDistanceUpdate = currentTime;
    
    // Debug output
    Serial.print("Remaining distance: ");
    Serial.println(remainingDistance);
    
    // Check if we've reached the turning point
    if (remainingDistance <= 0) {
      // We've reached the turning point - execute the turn
      if (nextDirection == "left") {
        handleMotorControl(-motorSpeed/2, motorSpeed/2, 500); // Turn left
      } else if (nextDirection == "right") {
        handleMotorControl(motorSpeed/2, -motorSpeed/2, 500); // Turn right
      } else if (nextDirection == "slight_left") {
        handleMotorControl(motorSpeed/4, motorSpeed/2, 500); // Slight left
      } else if (nextDirection == "slight_right") {
        handleMotorControl(motorSpeed/2, motorSpeed/4, 500); // Slight right
      } else if (nextDirection == "sharp_left") {
        handleMotorControl(-motorSpeed*0.7, motorSpeed*0.7, 700); // Sharp left
      } else if (nextDirection == "sharp_right") {
        handleMotorControl(motorSpeed*0.7, -motorSpeed*0.7, 700); // Sharp right
      } else if (nextDirection == "u_turn") {
        handleMotorControl(-motorSpeed, motorSpeed, 1500); // U-turn
      } else if (nextDirection == "stop") {
        handleMotorControl(0, 0, 0); // Stop
      } else {
        // Continue straight after the turn point
        handleMotorControl(motorSpeed, motorSpeed, 0);
      }
      
      // Reset for next instruction
      remainingDistance = 0;
    }
  }
}

// WebSocket event handler
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      // Stop motors when client disconnects
      handleMotorControl(0, 0, 0);
      break;
    
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
        
        // Send a welcome message
        String message = "{\"status\":\"connected\",\"message\":\"ESP32 Navigation Controller Ready\"}";
        webSocket.sendTXT(num, message);
      }
      break;
    
    case WStype_TEXT:
      {
        // Process JSON message
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, payload, length);
        
        if (error) {
          Serial.printf("JSON parsing error: %s\n", error.c_str());
          return;
        }
        
        // Process different message types
        String type = doc["type"];
        
        if (type == "navigation") {
          // Navigation instruction
          float distance = doc["distance"];
          String direction = doc["direction"];
          int speed = doc["speed"];
          
          handleNavigation(distance, direction, speed);
        } 
        else if (type == "motor") {
          // Direct motor control
          int leftSpeed = doc["left"];
          int rightSpeed = doc["right"];
          int duration = doc["duration"];
          
          handleMotorControl(leftSpeed, rightSpeed, duration);
        }
      }
      break;
  }
} 