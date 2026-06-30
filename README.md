# AEMS — Automated Energy Management System

AEMS is a full-stack IoT platform for SMEs in Cameroon to monitor electricity usage, automate device control, and reduce ghost energy consumption. It combines ESP32 hardware (PZEM meter, relays, PIR sensor) with a React dashboard and Node.js backend.

## Monorepo Structure

```
AEMS-FinalYear/
├── aems-backend/     Node.js API, MQTT bridge, automation engine
├── aems-frontend/    React dashboard (Vite)
├── aems-firmware/    ESP32 firmware (PlatformIO)
└── docs/             Architecture, hardware, user guide, testing
```

## Quick Start

### 1. Backend

```bash
cd aems-backend
cp .env.example .env
# Edit .env with Firebase, JWT, MQTT settings
npm install
npm start
```

### 2. Frontend

```bash
cd aems-frontend
cp .env.example .env
npm install
npm run dev
```

### 3. MQTT Broker

Install and run Mosquitto (or any MQTT broker) on your LAN. Set `MQTT_BROKER_URL` and `MQTT_BROKER_HOST` in backend `.env`.

### 4. ESP32 Hardware

Flash firmware from `aems-firmware/` with PlatformIO. Update `BACKEND_API_URL_VALUE` in `platformio.ini` to your server LAN IP.

On first boot, ESP32 creates WiFi hotspot **AEMS-Setup-XXXX**. Connect and open **http://192.168.4.1** to enter office WiFi and setup code.

### 5. Software Simulator (no hardware)

```bash
cd aems-backend
npm run simulate-esp32
# Or with setup code:
node src/test/simulateESP32.js --setup-code 123456
```

## User Flow

1. Register business + device on dashboard
2. Generate 6-digit setup code (Devices page)
3. Configure ESP32 via SoftAP portal
4. Monitor live energy, control relays, enable automation

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for detailed steps.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, MQTT topics, Firebase schema |
| [docs/HARDWARE_SETUP.md](docs/HARDWARE_SETUP.md) | Wiring, GPIO map, PlatformIO flash |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | SME onboarding walkthrough |
| [docs/TESTING.md](docs/TESTING.md) | Test checklist and simulator usage |

## Expected Outcomes

- Real-time energy monitoring dashboard
- Automated relay control (occupancy, after-hours)
- 20–30% reduction in wasted electricity (project target)
- Affordable deployment for Cameroonian SMEs

## License

Final-year academic project — see repository for authorship.
