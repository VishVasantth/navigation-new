/*
 * ESP32 WebSocket Path Receiver
 * 
 * This sketch creates a WiFi access point and WebSocket server on an ESP32
 * to receive path data from the web application.
 * 
 * Required libraries:
 * - WiFi (built-in with ESP32 Arduino core)
 * - WebSocketsServer (install via Library Manager)
 * - ArduinoJson (install via Library Manager - version 6.x)
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// WiFi Access Point settings
const char* ssid = "ESP32-AP";
const char* password = "password123";

// WebSocket server on port 81
WebSocketsServer webSocket = WebSocketsServer(81);

void setup() {
  Serial.begin(115200);
  
  // Set up ESP32 as an access point
  WiFi.softAP(ssid, password);
  
  Serial.println();
  Serial.print("ESP32 Access Point started. IP Address: ");
  Serial.println(WiFi.softAPIP());
  
  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  
  Serial.println("WebSocket server started. Ready to receive path data.");
}

void loop() {
  webSocket.loop();
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[WebSocket] Client #%u disconnected\n", num);
      break;
    
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[WebSocket] Client #%u connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
        
        // Send confirmation message back to client
        String message = "ESP32 connected and ready";
        webSocket.sendTXT(num, message);
        Serial.println("Sent confirmation message: " + message);
      }
      break;
    
    case WStype_TEXT:
      {
        // Convert payload to string
        String msg = String((char*)payload);
        
        Serial.println("[WebSocket] Received path data:");
        Serial.println(msg);
        
        // Parse JSON data
        DynamicJsonDocument doc(8192); // Adjust size based on your path complexity
        DeserializationError error = deserializeJson(doc, msg);
        
        if (error) {
          Serial.print("JSON parsing failed: ");
          Serial.println(error.c_str());
          
          // Send error message back to client
          String errorMsg = "Error parsing JSON: " + String(error.c_str());
          webSocket.sendTXT(num, errorMsg);
        } else {
          // Extract data
          const char* command = doc["command"];
          int totalPoints = doc["total_points"];
          int totalDistance = doc["total_distance_m"];
          int totalObstacles = doc["total_obstacles"];
          
          Serial.println("==== PATH DATA RECEIVED ====");
          Serial.print("Command: ");
          Serial.println(command);
          Serial.print("Total points: ");
          Serial.println(totalPoints);
          Serial.print("Total distance (m): ");
          Serial.println(totalDistance);
          Serial.print("Total obstacles: ");
          Serial.println(totalObstacles);
          
          // Process path points
          Serial.println("\nPath Points:");
          JsonArray pathArray = doc["path"];
          for (int i = 0; i < pathArray.size(); i++) {
            float lat = pathArray[i]["lat"];
            float lng = pathArray[i]["lng"];
            Serial.printf("Point %d: Lat %.6f, Lng %.6f\n", i+1, lat, lng);
          }
          
          // Process obstacles
          if (totalObstacles > 0) {
            Serial.println("\nObstacles:");
            JsonArray obstaclesArray = doc["obstacles"];
            for (int i = 0; i < obstaclesArray.size(); i++) {
              float lat = obstaclesArray[i]["lat"];
              float lng = obstaclesArray[i]["lng"];
              int radius = obstaclesArray[i]["radius_m"];
              Serial.printf("Obstacle %d: Lat %.6f, Lng %.6f, Radius %dm\n", 
                            i+1, lat, lng, radius);
            }
          }
          
          // Send confirmation back to the client
          String confirmMsg = "Path data received successfully. Points: " + 
                              String(totalPoints) + ", Distance: " + 
                              String(totalDistance) + "m";
          webSocket.sendTXT(num, confirmMsg);
          Serial.println("\nSent confirmation: " + confirmMsg);
          
          // Here you would process the path data for your robot's navigation
          // For example, storing the path in memory or sending it to a motor controller
          // --------------------------------------------------------------------
          // YOUR NAVIGATION CODE HERE
          // --------------------------------------------------------------------
        }
      }
      break;
  }
} 