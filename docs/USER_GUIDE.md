# AEMS User Guide

## 1. Create Your Account

1. Open the AEMS dashboard
2. Click **Register** and complete the 3-step wizard
3. Copy the **6-digit setup code** (valid 15 minutes)
4. Go to **Devices** in the sidebar

## 2. Connect Your ESP32

1. Power on the ESP32
2. Connect phone to WiFi **AEMS-Setup-XXXX**
3. Open **http://192.168.4.1**
4. Select office WiFi, enter password and setup code
5. Device appears online on the dashboard

Or use **Devices → Connect New ESP32** wizard for step-by-step guidance.

## 3. Manage Rooms

Four default zones are created after provisioning. On **Rooms** you can rename zones, toggle relays, and enable auto-shutdown.

## 4. Monitor Energy

- **Dashboard** — live metrics and bill estimate
- **Analytics** — 7/30-day charts
- **Alerts** — consumption and offline warnings
- **Settings** — automation thresholds and PDF export

## 5. Re-pair a Device

**Devices → Factory Reset**, then re-configure ESP32 via SoftAP with the new setup code.

## Simulator (no hardware)

```bash
cd aems-backend
npm run simulate-esp32
```

Enter setup code when prompted.
