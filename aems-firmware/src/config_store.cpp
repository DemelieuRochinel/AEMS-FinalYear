#include "config_store.h"
#include <Preferences.h>

ConfigStore configStore;

static Preferences prefs;

bool ConfigStore::begin() {
  return prefs.begin("aems", false);
}

bool ConfigStore::hasWifi() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String ssid = readPrefs.getString("wifi_ssid", "");
  readPrefs.end();
  return ssid.length() > 0;
}

bool ConfigStore::hasProvisioning() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String id = readPrefs.getString("device_id", "");
  readPrefs.end();
  return id.length() > 0;
}

String ConfigStore::wifiSsid() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String value = readPrefs.getString("wifi_ssid", "");
  readPrefs.end();
  return value;
}

String ConfigStore::wifiPassword() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String value = readPrefs.getString("wifi_pass", "");
  readPrefs.end();
  return value;
}

String ConfigStore::deviceId() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String value = readPrefs.getString("device_id", "");
  readPrefs.end();
  return value;
}

String ConfigStore::businessId() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String value = readPrefs.getString("business_id", "");
  readPrefs.end();
  return value;
}

String ConfigStore::mqttBroker() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  String value = readPrefs.getString("mqtt_broker", "");
  readPrefs.end();
  return value;
}

int ConfigStore::mqttPort() const {
  Preferences readPrefs;
  readPrefs.begin("aems", true);
  int value = readPrefs.getInt("mqtt_port", 1883);
  readPrefs.end();
  return value;
}

void ConfigStore::saveWifi(const String& ssid, const String& password) {
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", password);
}

void ConfigStore::saveProvisioning(const String& deviceId, const String& businessId,
                                   const String& mqttBroker, int mqttPort) {
  prefs.putString("device_id", deviceId);
  prefs.putString("business_id", businessId);
  prefs.putString("mqtt_broker", mqttBroker);
  prefs.putInt("mqtt_port", mqttPort);
  prefs.putBool("provisioned", true);
}

void ConfigStore::clearAll() {
  prefs.clear();
}
