#include <Arduino.h>

#define PIR_PIN 27

bool lastState = false;
int motionCount = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);
  pinMode(PIR_PIN, INPUT);

  Serial.println("================================================");
  Serial.println("  AEMS PIR Test — GPIO27");
  Serial.println("  Warming up 10 seconds...");
  Serial.println("================================================");

  for (int i = 10; i > 0; i--) {
    Serial.print("  ");
    Serial.print(i);
    Serial.println("...");
    delay(1000);
  }
  Serial.println("  READY — wave your hand!\n");
}

void loop() {
  bool motion = digitalRead(PIR_PIN);

  if (motion != lastState) {
    lastState = motion;
    if (motion) {
      motionCount++;
      Serial.print("[OCCUPIED] Motion! Count: ");
      Serial.println(motionCount);
    } else {
      Serial.println("[EMPTY]    No motion.");
    }
  }
  delay(100);
}