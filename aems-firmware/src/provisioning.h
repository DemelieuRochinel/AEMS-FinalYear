#ifndef PROVISIONING_H
#define PROVISIONING_H

#include <Arduino.h>

struct ClaimResult {
  bool success;
  String deviceId;
  String businessId;
  String mqttBroker;
  int mqttPort;
  String errorMessage;
};

ClaimResult claimDeviceWithCode(const String& setupCode);

#endif
