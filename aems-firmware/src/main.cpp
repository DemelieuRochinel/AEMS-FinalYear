
//  WHAT THIS DOES:
//  Every 5 seconds:
//  1. Reads PZEM-004T  → Voltage, Current, Power, kWh, Hz, PF
//  2. Reads PIR sensor → Room 1 occupancy (motion/empty)
//  3. Builds JSON payload with all data
//  4. Publishes to MQTT → backend saves to Firebase
//  5. Listens for relay commands → turns devices ON/OFF
//
//  PIN MAP:
//  PZEM TX  → GPIO16    PZEM RX  → GPIO17
//  PIR OUT  → GPIO27
//  RELAY 1  → GPIO18    RELAY 2  → GPIO19
//  RELAY 3  → GPIO21    RELAY 4  → GPIO22
//  LED      → GPIO2

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>

//  ⚠️  UPDATE THESE BEFORE FLASHING
const char* WIFI_SSID     = "Galaxy S9e706";
const char* WIFI_PASSWORD = "Roch2003$$";
const char* MQTT_BROKER   = "192.168.43.137";
const int   MQTT_PORT     = 1883;
const char* DEVICE_ID     = "device_BUEA001"; // this is the software part that we have to add and make in the way that the user can create a device for it office 
const char* BUSINESS_ID   = "business_demo_001";// and here the device have to be link to the particular user
const long  SEND_INTERVAL = 5000;

//  PIN DEFINITIONS
#define PZEM_RX_PIN  16
#define PZEM_TX_PIN  17
#define PIR_PIN      27
#define RELAY_1      18   // Room 1 — Main Office
#define RELAY_2      19   // Room 2 — Meeting Room
#define RELAY_3      21   // Room 3 — Reception
#define RELAY_4      22   // Room 4 — Server Room
#define LED_PIN       2

//  GLOBAL OBJECTS
PZEM004Tv30  pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

//  STATE
bool relayState[4]     = { true, false, true, true };
bool currentMotion     = false;
bool lastMotionState   = false;
unsigned long lastSend = 0;
int readingCount       = 0;

//  RELAY HELPER
//  Active LOW: LOW = relay ON, HIGH = relay OFF
void setRelay(int index, bool on) {
  int pins[4] = { RELAY_1, RELAY_2, RELAY_3, RELAY_4 };
  digitalWrite(pins[index], on ? LOW : HIGH);
  relayState[index] = on;
}

void initRelays() {
  int pins[4] = { RELAY_1, RELAY_2, RELAY_3, RELAY_4 };
  for (int i = 0; i < 4; i++) {
    pinMode(pins[i], OUTPUT);
    setRelay(i, relayState[i]);
  }
}

//  MQTT CALLBACK
//  Receives relay commands from dashboard
//  Format: { "relay_id": "relay_1", "action": "OFF" }
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("\n>>> COMMAND FROM DASHBOARD:");
  Serial.println(message);

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, message)) return;

  const char* relayId = doc["relay_id"];
  const char* action  = doc["action"];
  if (!relayId || !action) return;

  int idx = -1;
  if      (strcmp(relayId, "relay_1") == 0) idx = 0;
  else if (strcmp(relayId, "relay_2") == 0) idx = 1;
  else if (strcmp(relayId, "relay_3") == 0) idx = 2;
  else if (strcmp(relayId, "relay_4") == 0) idx = 3;

  if (idx == -1) return;

  bool turnOn = (strcmp(action, "ON") == 0);
  setRelay(idx, turnOn);

  Serial.print("Relay ");
  Serial.print(idx + 1);
  Serial.print(" → ");
  Serial.println(turnOn ? "ON" : "OFF");
}

//  WIFI CONNECT
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    if (++attempts > 40) {
      Serial.println("\nWiFi timeout — restarting");
      ESP.restart();
    }
  }
  digitalWrite(LED_PIN, HIGH);
  Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());
}

//  MQTT CONNECT
void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "AEMS_" + String(DEVICE_ID) + "_" + String(millis());

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected!");

      // Subscribe to commands
      String cmdTopic = String("aems/") + DEVICE_ID + "/commands";
      mqttClient.subscribe(cmdTopic.c_str());

      // Publish online status
      String statusTopic   = String("aems/") + DEVICE_ID + "/status";
      String statusPayload = "{\"status\":\"online\",\"device_id\":\"" +
                             String(DEVICE_ID) + "\",\"business_id\":\"" +
                             String(BUSINESS_ID) + "\"}";
      mqttClient.publish(statusTopic.c_str(), statusPayload.c_str(), true);
      Serial.println("Online status published");

    } else {
      Serial.print("failed rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retry in 3s");
      delay(3000);
    }
  }
}

//  SETUP
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("My AEMS Final Firmware starting... ");

  // LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // PIR
  pinMode(PIR_PIN, INPUT);
  Serial.println("PIR sensor ready on GPIO27");

  // Relays
  initRelays();
  Serial.println("Relay module ready — 4 relays initialized");

  // PZEM
  Serial2.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);
  delay(1000);
  Serial.println("PZEM-004T initialized on GPIO16/17");

  // WiFi
  connectWiFi();

  // MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);
  connectMQTT();

  Serial.println("\n✅ AEMS System Ready!");
  Serial.println("Sending readings every 5 seconds...\n");
  lastSend = millis();
}

//  LOOP
void loop() {

  // Maintain WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    connectWiFi();
  }

  // Maintain MQTT
  if (!mqttClient.connected()) {
    Serial.println("MQTT lost — reconnecting...");
    connectMQTT();
  }
  mqttClient.loop();

  // Read PIR
  currentMotion = (digitalRead(PIR_PIN) == HIGH);
  if (currentMotion != lastMotionState) {
    lastMotionState = currentMotion;
    Serial.println(currentMotion ?
      ">>> PIR: Room 1 OCCUPIED" :
      "    PIR: Room 1 empty");
  }

  // Send reading every 5 seconds
  if (millis() - lastSend >= SEND_INTERVAL) {
    lastSend = millis();
    readingCount++;

    // Read PZEM
    float voltage   = pzem.voltage();
    float current   = pzem.current();
    float power     = pzem.power();
    float energy    = pzem.energy();
    float frequency = pzem.frequency();
    float pf        = pzem.pf();
    bool  pzemOk    = !isnan(voltage);

    // Build JSON
    StaticJsonDocument<768> doc;
    doc["device_id"]   = DEVICE_ID;
    doc["business_id"] = BUSINESS_ID;
    doc["timestamp"]   = millis();
    doc["reading_num"] = readingCount;

    JsonObject main = doc.createNestedObject("main");
    if (pzemOk) {
      main["voltage"]      = round(voltage   * 10)  / 10.0;
      main["current"]      = round(current   * 100) / 100.0;
      main["power"]        = round(power     * 10)  / 10.0;
      main["energy_kwh"]   = round(energy    * 1000)/ 1000.0;
      main["frequency"]    = round(frequency * 100) / 100.0;
      main["power_factor"] = round(pf        * 100) / 100.0;
      main["pzem_ok"]      = true;
    } else {
      // PZEM not reading mains yet — send zeros
      main["voltage"]      = 0.0;
      main["current"]      = 0.0;
      main["power"]        = 0.0;
      main["energy_kwh"]   = 0.0;
      main["frequency"]    = 0.0;
      main["power_factor"] = 0.0;
      main["pzem_ok"]      = false;
    }

    // Room occupancy from PIR
    JsonObject rooms = doc.createNestedObject("rooms");
    JsonObject r1    = rooms.createNestedObject("room_1");
    r1["occupied"] = currentMotion;
    r1["relay"]    = "relay_1";

    JsonObject r2 = rooms.createNestedObject("room_2");
    r2["occupied"] = false;
    r2["relay"]    = "relay_2";

    JsonObject r3 = rooms.createNestedObject("room_3");
    r3["occupied"] = false;
    r3["relay"]    = "relay_3";

    JsonObject r4 = rooms.createNestedObject("room_4");
    r4["occupied"] = false;
    r4["relay"]    = "relay_4";

    // Relay states
    JsonObject relays = doc.createNestedObject("relays");
    relays["relay_1"] = relayState[0] ? "ON" : "OFF";
    relays["relay_2"] = relayState[1] ? "ON" : "OFF";
    relays["relay_3"] = relayState[2] ? "ON" : "OFF";
    relays["relay_4"] = relayState[3] ? "ON" : "OFF";

    // Publish
    char payload[768];
    size_t len = serializeJson(doc, payload, sizeof(payload));
    String topic = String("aems/") + DEVICE_ID + "/readings";
    bool ok = mqttClient.publish(topic.c_str(), payload, len);

    // Serial monitor output
    Serial.print("Reading #");
    Serial.print(readingCount);
    Serial.print(" | ");

    if (pzemOk) {
      Serial.print(voltage, 1);   Serial.print("V | ");
      Serial.print(current, 2);   Serial.print("A | ");
      Serial.print(power,   0);   Serial.print("W | ");
      Serial.print(energy,  3);   Serial.print("kWh | ");
    } else {
      Serial.print("PZEM: no mains | ");
    }

    Serial.print("PIR:");
    Serial.print(currentMotion ? "OCCUPIED" : "empty");
    Serial.print(" | MQTT:");
    Serial.println(ok ? "✓ SENT" : "✗ FAILED");

    // Blink LED on each send
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
}