# AEMS Testing Guide

## Software Simulator

```bash
cd aems-backend
npm run simulate-esp32
# Or:
node src/test/simulateESP32.js --setup-code 123456
```

Delete `src/test/device.config.json` to force re-provisioning.

## Manual Test Checklist

### Registration and provisioning

- [ ] Register new business + device
- [ ] Setup code displays; browser does NOT consume code
- [ ] ESP32 SoftAP `AEMS-Setup-XXXX` visible
- [ ] Portal at 192.168.4.1 accepts WiFi + code
- [ ] Device shows Connected on Devices page
- [ ] Four default rooms auto-created

### Live data and control

- [ ] Dashboard live readings update
- [ ] Relay toggle from Rooms page reaches device
- [ ] PIR updates occupancy on relay_1

### Factory reset

- [ ] Dashboard Factory Reset generates new code
- [ ] BOOT hold 10s clears ESP32 NVS

## Energy Savings Methodology

1. Baseline week — manual control, record daily kWh
2. Automation week — enable auto-shutdown and after-hours
3. Compare: `(baseline - automated) / baseline × 100%`

Target: 20–30% reduction in off-hours consumption.
