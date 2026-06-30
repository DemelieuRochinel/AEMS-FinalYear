# AEMS Hardware Setup

## Components

| Component | Purpose |
|-----------|---------|
| ESP32 DevKit | Main microcontroller |
| PZEM-004T v3.0 | Mains voltage, current, power, energy |
| 4-channel relay module | Switch loads (lights, machines) |
| PIR motion sensor | Occupancy detection (relay 1 zone) |

## GPIO Map

| GPIO | Function |
|------|----------|
| 16 | PZEM RX (Serial2) |
| 17 | PZEM TX (Serial2) |
| 27 | PIR sensor input |
| 18 | Relay 1 |
| 19 | Relay 2 |
| 21 | Relay 3 |
| 22 | Relay 4 |
| 2 | Status LED |
| 0 | BOOT button (factory reset: hold 10s at power-on) |

Relays are active-LOW (LOW = ON).

## PlatformIO Flash

Edit `aems-firmware/platformio.ini`:

```ini
build_flags =
  -DBACKEND_API_URL_VALUE=\"http://YOUR_LAN_IP:5000/api\"
  -DFIRMWARE_VERSION_VALUE=\"1.1.0\"
```

```bash
cd aems-firmware
pio run -t upload
pio device monitor
```

## First Boot / Provisioning

1. Power on ESP32
2. Connect to WiFi **AEMS-Setup-XXXX**
3. Open **http://192.168.4.1**
4. Enter office WiFi, password, and 6-digit setup code
5. Device reboots and connects to dashboard

## Factory Reset

Hold **BOOT** button for **10 seconds** at power-on to clear NVS and restart SoftAP portal.
