#ifndef CONFIG_STORE_H
#define CONFIG_STORE_H

#include <Arduino.h>

class ConfigStore {
public:
  bool begin();
  bool hasWifi() const;
  bool hasProvisioning() const;
  String wifiSsid() const;
  String wifiPassword() const;
  String deviceId() const;
  String businessId() const;
  String mqttBroker() const;
  int mqttPort() const;

  void saveWifi(const String& ssid, const String& password);
  void saveProvisioning(const String& deviceId, const String& businessId,
                        const String& mqttBroker, int mqttPort);
  void clearAll();
};

extern ConfigStore configStore;

#endif
