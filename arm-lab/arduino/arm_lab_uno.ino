/*
  Arm Lab: optional USB/serial bridge starter for Arduino Uno.
  The simulator does not connect to this sketch yet.
  Calibrate ONE UNLOADED SERVO at a time before attaching the arm linkage.
  Use a separate regulated servo supply with common ground. Not Uno 5V.

  115200 baud, newline-terminated commands:
    ARM                    attach all outputs at calibrated neutral
    SET,90,90,90,90        base, shoulder, elbow, gripper SERVO DEGREES
    STOP                   detach all servo outputs
  STOP releases holding torque: support the arm so it cannot fall.
*/
#include <Servo.h>
#include <stdlib.h>
#include <string.h>

Servo motors[4];
const byte PINS[4] = {3, 5, 6, 9};
// Conservative EXAMPLE values, not a calibration for your hardware.
const int MIN_DEG[4] = {60, 60, 60, 80};
const int MAX_DEG[4] = {120, 120, 120, 100};
const int NEUTRAL[4] = {90, 90, 90, 90};
int current[4] = {90, 90, 90, 90};
int target[4] = {90, 90, 90, 90};
bool armed = false;
char buffer[64];
byte used = 0;
bool overflow = false;
unsigned long lastStep = 0;

void handleLine() {
  if (strcmp(buffer, "STOP") == 0) {
    for (byte i = 0; i < 4; i++) motors[i].detach();
    armed = false;
    Serial.println(F("OK STOPPED"));
    return;
  }
  if (strcmp(buffer, "ARM") == 0) {
    if (!armed) for (byte i = 0; i < 4; i++) {
      current[i] = target[i] = NEUTRAL[i];
      motors[i].write(NEUTRAL[i]);
      motors[i].attach(PINS[i]);
    }
    armed = true;
    Serial.println(F("OK ARMED"));
    return;
  }
  if (strncmp(buffer, "SET,", 4) != 0) { Serial.println(F("ERR COMMAND")); return; }
  if (!armed) { Serial.println(F("ERR NOT_ARMED")); return; }
  int next[4];
  char* cursor = buffer + 4;
  for (byte i = 0; i < 4; i++) {
    char* end;
    long value = strtol(cursor, &end, 10);
    if (end == cursor || value < MIN_DEG[i] || value > MAX_DEG[i] || (i < 3 ? *end != ',' : *end != '\0')) {
      Serial.println(F("ERR RANGE_OR_FORMAT")); return;
    }
    next[i] = (int)value;
    cursor = end + 1;
  }
  for (byte i = 0; i < 4; i++) target[i] = next[i];
  Serial.println(F("OK TARGET"));
}

void setup() { Serial.begin(115200); Serial.println(F("ARM_LAB READY DISARMED")); }
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      buffer[used] = '\0';
      if (overflow) Serial.println(F("ERR LINE_TOO_LONG"));
      else if (used) handleLine();
      used = 0; overflow = false;
    } else if (used < sizeof(buffer) - 1) buffer[used++] = c;
    else overflow = true;
  }
  unsigned long now = millis();
  if (armed && now - lastStep >= 20) {
    lastStep = now;
    for (byte i = 0; i < 4; i++) {
      if (current[i] < target[i]) current[i]++;
      else if (current[i] > target[i]) current[i]--;
      motors[i].write(current[i]);
    }
  }
}
