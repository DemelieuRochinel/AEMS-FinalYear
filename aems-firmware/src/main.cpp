#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include "config_store.h"
#include "setup_portal.h"

#ifndef FIRMWARE_VERSION_VALUE
#define FIRMWARE_VERSION_VALUE "1.0.0"
#endif

const char* FIRMWARE_VERSION = FIRMWARE_VERSION_VALUE;
const long SEND_INTERVAL = 5000;

#define PZEM_RX_PIN  16
#define PZEM_TX_PIN  17
#define PIR_PIN      27
#define RELAY_1      18
#define RELAY_2      19
#define RELAY_3      21
#define RELAY_4      22
#define LED_PIN       2

PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

String deviceId;
String businessId;
String mqttBroker;
int mqttPort = 1883;

bool relayState[4] = { true, false, true, true };
bool currentMotion = false;
bool lastMotionState = false;
unsigned long lastSend = 0;
int readingCount = 0;

const char* relayIds[4] = { "relay_1", "relay_2", "relay_3", "relay_4" };
const int relayPins[4] = { RELAY_1, RELAY_2, RELAY_3, RELAY_4 };

void setRelay(int index, bool on) {
  if (index < 0 || index >= 4) return;
  digitalWrite(relayPins[index], on ? LOW : HIGH);
  relayState[index] = on;
}

void initRelays() {
  for (int i = 0; i < 4; i++) {
    pinMode(relayPins[i], OUTPUT);
    setRelay(i, relayState[i]);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("\nCommand from dashboard:");
  Serial.println(message);

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, message)) return;

  const char* relayId = doc["relay_id"];
  const char* action = doc["status"] | doc["action"];
  if (!relayId || !action) return;

  int idx = -1;
  for (int i = 0; i < 4; i++) {
    if (strcmp(relayId, relayIds[i]) == 0) {
      idx = i;
      break;
    }
  }

  if (idx == -1) return;

  bool turnOn = strcmp(action, "ON") == 0;
  setRelay(idx, turnOn);

  Serial.print("Relay ");
  Serial.print(idx + 1);
  Serial.print(" -> ");
  Serial.println(turnOn ? "ON" : "OFF");
}

void connectWiFi() {
  String ssid = configStore.wifiSsid();
  String password = configStore.wifiPassword();

  if (ssid.length() == 0) {
    Serial.println("No WiFi credentials — starting setup portal");
    runSetupPortal();
    ssid = configStore.wifiSsid();
    password = configStore.wifiPassword();
  }

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  WiFi.setSleep(false);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    if (++attempts > 40) {
      Serial.println("\nWiFi timeout — clearing WiFi and restarting setup portal");
      configStore.clearAll();
      ESP.restart();
    }
  }

  digitalWrite(LED_PIN, HIGH);
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

void ensureProvisioned() {
  if (!configStore.hasProvisioning()) {
    Serial.println("Not provisioned — starting setup portal");
    runSetupPortal();
  }

  deviceId = configStore.deviceId();
  businessId = configStore.businessId();
  mqttBroker = configStore.mqttBroker();
  mqttPort = configStore.mqttPort();

  Serial.println("Device ID: " + deviceId);
  Serial.println("MQTT: " + mqttBroker + ":" + String(mqttPort));
}

void connectMQTT() {
  if (mqttBroker.length() == 0) {
    Serial.println("No MQTT broker configured — restarting setup portal");
    configStore.clearAll();
    ESP.restart();
  }

  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "AEMS_" + deviceId + "_" + String(millis());

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected.");

      String cmdTopic = "aems/" + deviceId + "/commands";
      mqttClient.subscribe(cmdTopic.c_str());

      StaticJsonDocument<160> status;
      status["status"] = "online";
      status["device_id"] = deviceId;
      status["business_id"] = businessId;

      char payload[160];
      serializeJson(status, payload, sizeof(payload));

      String statusTopic = "aems/" + deviceId + "/status";
      mqttClient.publish(statusTopic.c_str(), payload, true);
      Serial.println("Online status published.");
    } else {
      Serial.print("failed rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retry in 3s");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("AEMS firmware starting...");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(PIR_PIN, INPUT);

  configStore.begin();
  initRelays();
  Serial2.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);
  delay(1000);

  if (!configStore.hasWifi() || !configStore.hasProvisioning()) {
    runSetupPortal();
  }

  connectWiFi();
  ensureProvisioned();

  mqttClient.setServer(mqttBroker.c_str(), mqttPort);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  connectMQTT();

  Serial.println("AEMS system ready.");
  lastSend = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost - reconnecting...");
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    Serial.println("MQTT lost - reconnecting...");
    connectMQTT();
  }
  mqttClient.loop();

  currentMotion = digitalRead(PIR_PIN) == HIGH;
  if (currentMotion != lastMotionState) {
    lastMotionState = currentMotion;
    Serial.println(currentMotion ? "PIR: occupied" : "PIR: empty");
  }

  if (millis() - lastSend < SEND_INTERVAL) {
    return;
  }

  lastSend = millis();
  readingCount++;

  float voltage = pzem.voltage();
  float current = pzem.current();
  float power = pzem.power();
  float energy = pzem.energy();
  float frequency = pzem.frequency();
  float pf = pzem.pf();
  bool pzemOk = !isnan(voltage);

  StaticJsonDocument<768> doc;
  doc["device_id"] = deviceId;
  doc["business_id"] = businessId;
  doc["timestamp"] = millis();
  doc["reading_num"] = readingCount;

  JsonObject mainObj = doc.createNestedObject("main");
  mainObj["voltage"] = pzemOk ? round(voltage * 10) / 10.0 : 0.0;
  mainObj["current"] = pzemOk ? round(current * 100) / 100.0 : 0.0;
  mainObj["power"] = pzemOk ? round(power * 10) / 10.0 : 0.0;
  mainObj["energy_kwh"] = pzemOk ? round(energy * 1000) / 1000.0 : 0.0;
  mainObj["frequency"] = pzemOk ? round(frequency * 100) / 100.0 : 0.0;
  mainObj["power_factor"] = pzemOk ? round(pf * 100) / 100.0 : 0.0;
  mainObj["pzem_ok"] = pzemOk;

  JsonObject rooms = doc.createNestedObject("rooms");
  for (int i = 0; i < 4; i++) {
    JsonObject room = rooms.createNestedObject(relayIds[i]);
    room["relay"] = relayIds[i];
    room["occupied"] = i == 0 ? currentMotion : false;
    room["relay_status"] = relayState[i] ? "ON" : "OFF";
  }

  JsonObject relays = doc.createNestedObject("relays");
  for (int i = 0; i < 4; i++) {
    relays[relayIds[i]] = relayState[i] ? "ON" : "OFF";
  }

  char payload[768];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  String topic = "aems/" + deviceId + "/readings";
  bool ok = mqttClient.publish(topic.c_str(), payload, len);

  Serial.print("Reading #");
  Serial.print(readingCount);
  Serial.print(" | ");
  Serial.print(pzemOk ? "PZEM ok" : "PZEM no mains");
  Serial.print(" | PIR:");
  Serial.print(currentMotion ? "occupied" : "empty");
  Serial.print(" | MQTT:");
  Serial.println(ok ? "sent" : "failed");

  digitalWrite(LED_PIN, HIGH);
  delay(50);
  digitalWrite(LED_PIN, LOW);
}
