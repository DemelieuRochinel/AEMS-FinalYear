#include "provisioning.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#ifndef BACKEND_API_URL_VALUE
#define BACKEND_API_URL_VALUE "http://192.168.1.100:5000/api"
#endif

#ifndef FIRMWARE_VERSION_VALUE
#define FIRMWARE_VERSION_VALUE "1.0.0"
#endif

static const char* BACKEND_API_URL = BACKEND_API_URL_VALUE;
static const char* FIRMWARE_VERSION = FIRMWARE_VERSION_VALUE;

ClaimResult claimDeviceWithCode(const String& setupCode) {
  ClaimResult result;
  result.success = false;
  result.mqttPort = 1883;

  if (setupCode.length() != 6) {
    result.errorMessage = "Setup code must be 6 digits";
    return result;
  }

  if (strlen(BACKEND_API_URL) == 0) {
    result.errorMessage = "Backend API URL not configured";
    return result;
  }

  HTTPClient http;
  String url = String(BACKEND_API_URL) + "/provision/claim-device";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);

  StaticJsonDocument<256> request;
  request["setup_code"] = setupCode;
  request["mac_address"] = WiFi.macAddress();
  request["firmware_version"] = FIRMWARE_VERSION;

  String body;
  serializeJson(request, body);

  int statusCode = http.POST(body);
  String response = http.getString();
  http.end();

  if (statusCode != 200) {
    StaticJsonDocument<256> errDoc;
    if (!deserializeJson(errDoc, response)) {
      const char* msg = errDoc["message"];
      result.errorMessage = msg ? String(msg) : ("HTTP " + String(statusCode));
    } else {
      result.errorMessage = "HTTP " + String(statusCode);
    }
    return result;
  }

  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, response)) {
    result.errorMessage = "Invalid response from server";
    return result;
  }

  const char* deviceId = doc["device_id"];
  const char* businessId = doc["business_id"];
  if (!deviceId || !businessId) {
    result.errorMessage = "Missing device or business ID in response";
    return result;
  }

  result.deviceId = String(deviceId);
  result.businessId = String(businessId);

  const char* broker = doc["mqtt_broker"];
  if (!broker && doc["configuration"].is<JsonObject>()) {
    broker = doc["configuration"]["mqtt_broker"];
  }
  result.mqttBroker = broker ? String(broker) : "";

  int port = doc["mqtt_port"] | 0;
  if (port == 0 && doc["configuration"].is<JsonObject>()) {
    port = doc["configuration"]["mqtt_port"] | 1883;
  }
  result.mqttPort = port > 0 ? port : 1883;

  if (result.mqttBroker.length() == 0) {
    result.errorMessage = "Server did not return MQTT broker address";
    return result;
  }

  result.success = true;
  return result;
}
