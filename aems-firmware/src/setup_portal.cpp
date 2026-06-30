#include "setup_portal.h"
#include "config_store.h"
#include "provisioning.h"
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <esp_wifi.h>

#define SETUP_AP_IP "192.168.4.1"
#define BOOT_BUTTON_PIN 0
#define FACTORY_RESET_MS 10000

static WebServer server(80);
static DNSServer dnsServer;
static bool portalComplete = false;
static String portalError = "";

static const char PORTAL_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AEMS Setup</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #0e1b29; color: #fff; margin: 0; padding: 20px; }
    .card { max-width: 420px; margin: 0 auto; background: #182a3d; border: 1px solid #243b54; border-radius: 12px; padding: 24px; }
    h1 { color: #10b981; font-size: 22px; margin: 0 0 8px; text-align: center; }
    p { color: #94a3b8; font-size: 14px; text-align: center; }
    label { display: block; color: #94a3b8; font-size: 13px; margin: 14px 0 6px; }
    input, select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #36506c; background: #223a54; color: #fff; font-size: 16px; }
    input.code { letter-spacing: 8px; text-align: center; font-weight: bold; font-family: monospace; }
    button { width: 100%; margin-top: 20px; padding: 14px; background: #10b981; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }
    .err { background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #f87171; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
    .ok { background: rgba(16,185,129,0.15); border: 1px solid #10b981; color: #34d399; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>AEMS Setup</h1>
    <p>Connect this device to your AEMS dashboard</p>
    %MESSAGE%
    <form method="POST" action="/save">
      <label>WiFi Network</label>
      <select name="ssid" required>%NETWORKS%</select>
      <label>WiFi Password</label>
      <input type="password" name="password" placeholder="Your WiFi password">
      <label>6-Digit Setup Code</label>
      <input class="code" type="text" name="setup_code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required>
      <button type="submit">Connect Device</button>
    </form>
  </div>
</body>
</html>
)rawliteral";

static String buildNetworkOptions() {
  int count = WiFi.scanNetworks();
  String options = "";
  if (count <= 0) {
    options = "<option value=\"\">No networks found — retry</option>";
  } else {
    for (int i = 0; i < count; i++) {
      options += "<option value=\"" + WiFi.SSID(i) + "\">" + WiFi.SSID(i) + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
    }
  }
  return options;
}

static String renderPage(const String& messageHtml) {
  String html = FPSTR(PORTAL_HTML);
  html.replace("%MESSAGE%", messageHtml);
  html.replace("%NETWORKS%", buildNetworkOptions());
  return html;
}

static bool connectToWifi(const String& ssid, const String& password, String& errorOut) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  WiFi.setSleep(false);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    dnsServer.processNextRequest();
    server.handleClient();
  }

  if (WiFi.status() != WL_CONNECTED) {
    errorOut = "Could not connect to WiFi. Check SSID and password.";
    return false;
  }
  return true;
}

static void handleRoot() {
  String msg = portalError.length() > 0
    ? "<div class=\"err\">" + portalError + "</div>"
    : "<div class=\"ok\">Enter your office WiFi and the setup code from your AEMS dashboard.</div>";
  server.send(200, "text/html", renderPage(msg));
}

static void handleSave() {
  if (!server.hasArg("ssid") || !server.hasArg("setup_code")) {
    portalError = "Missing required fields.";
    handleRoot();
    return;
  }

  String ssid = server.arg("ssid");
  String password = server.arg("password");
  String setupCode = server.arg("setup_code");
  setupCode.replace(" ", "");

  if (setupCode.length() != 6) {
    portalError = "Setup code must be exactly 6 digits.";
    handleRoot();
    return;
  }

  server.send(200, "text/html",
    "<html><body style=\"background:#0e1b29;color:#10b981;font-family:Arial;text-align:center;padding:40px;\">"
    "<h2>Connecting to WiFi...</h2><p>Please wait. Do not close this page.</p></body></html>");
  server.client().stop();
  delay(100);

  dnsServer.stop();
  server.stop();

  String wifiError;
  if (!connectToWifi(ssid, password, wifiError)) {
    portalError = wifiError;
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_AP);
    dnsServer.start(53, "*", WiFi.softAPIP());
    server.begin();
    return;
  }

  configStore.saveWifi(ssid, password);

  ClaimResult claim = claimDeviceWithCode(setupCode);
  if (!claim.success) {
    portalError = claim.errorMessage;
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    dnsServer.start(53, "*", WiFi.softAPIP());
    server.begin();
    return;
  }

  configStore.saveProvisioning(claim.deviceId, claim.businessId, claim.mqttBroker, claim.mqttPort);
  portalComplete = true;

  WiFi.disconnect(true);
  delay(500);
  ESP.restart();
}

static void handleNotFound() {
  server.sendHeader("Location", "http://" SETUP_AP_IP "/", true);
  server.send(302, "text/plain", "");
}

static String getApSsid() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%02X%02X", mac[4], mac[5]);
  return String("AEMS-Setup-") + suffix;
}

static bool checkFactoryReset() {
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);
  if (digitalRead(BOOT_BUTTON_PIN) != LOW) return false;

  Serial.println("BOOT held — hold 10s for factory reset...");
  unsigned long start = millis();
  while (digitalRead(BOOT_BUTTON_PIN) == LOW) {
    if (millis() - start >= FACTORY_RESET_MS) {
      Serial.println("Factory reset — clearing NVS");
      configStore.clearAll();
      return true;
    }
    delay(100);
  }
  return false;
}

bool runSetupPortal() {
  if (checkFactoryReset()) {
    Serial.println("Configuration cleared. Starting setup portal.");
  }

  portalComplete = false;
  portalError = "";

  String apSsid = getApSsid();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid.c_str());
  IPAddress apIp(192, 168, 4, 1);
  WiFi.softAPConfig(apIp, apIp, IPAddress(255, 255, 255, 0));

  Serial.println("Setup portal started");
  Serial.print("SSID: ");
  Serial.println(apSsid);
  Serial.println("Open http://192.168.4.1");

  dnsServer.start(53, "*", apIp);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleNotFound);
  server.begin();

  WiFi.scanNetworks(true);

  while (!portalComplete) {
    dnsServer.processNextRequest();
    server.handleClient();
    delay(10);
  }

  return true;
}
