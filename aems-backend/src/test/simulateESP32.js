//  ESP32 SIMULATOR with PROVISIONING
//  Simulates real ESP32 hardware sending sensor data
//  Now with automatic device provisioning!
//
//  Run: node src/test/simulateESP32.js
//  First run will ask for setup code from dashboard
//  Subsequent runs use saved configuration

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios'); // Make sure to install: npm install axios
require('dotenv').config();

const CLI_SETUP_CODE = (() => {
  const idx = process.argv.indexOf('--setup-code');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\D/g, '').slice(0, 6);
  }
  return null;
})();

// ── Configuration ──
const CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000/api',
  intervalMs: 5000,
  configFile: path.join(__dirname, 'device.config.json'),
};

// ── Create readline interface for user input ──
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ── Question helper ──
const askQuestion = (query) => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
};

// ── Configuration Manager ──
class ConfigManager {
  constructor(configFile) {
    this.configFile = configFile;
    this.config = null;
  }

  // Load config from file
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        this.config = JSON.parse(data);
        console.log(` Device configuration loaded: ${this.config.device_id}`);
        return true;
      }
      console.log('No device configuration found');
      return false;
    } catch (error) {
      console.error('Failed to load config:', error.message);
      return false;
    }
  }

  // Save config to file
  save(deviceId, businessId, configData = {}) {
    try {
      this.config = {
        device_id: deviceId,
        business_id: businessId,
        provisioned_at: new Date().toISOString(),
        provisioned: true,
        broker_url: configData.broker_url || CONFIG.brokerUrl,
        ...configData,
      };
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
      console.log(`Configuration saved to ${this.configFile}`);
      return true;
    } catch (error) {
      console.error('Failed to save config:', error.message);
      return false;
    }
  }

  // Get device ID
  getDeviceId() {
    return this.config?.device_id || null;
  }

  // Get business ID
  getBusinessId() {
    return this.config?.business_id || null;
  }

  getBrokerUrl() {
    return this.config?.broker_url || CONFIG.brokerUrl;
  }

  // Check if provisioned
  isProvisioned() {
    return this.config?.provisioned || false;
  }

  // Delete config (for re-provisioning)
  delete() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
        console.log('Configuration deleted');
        this.config = null;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete config:', error.message);
      return false;
    }
  }
}

// ── Provisioning Service ──
class ProvisioningService {
  constructor(backendUrl) {
    this.backendUrl = backendUrl;
  }

  // Claim device with setup code
  async claimDevice(setupCode, macAddress = null, firmwareVersion = null) {
    try {
      console.log(`Claiming device with code: ${setupCode}...`);
      
      const response = await axios.post(
        `${this.backendUrl}/provision/claim-device`,
        {
          setup_code: setupCode,
          mac_address: macAddress || this.getMacAddress(),
          firmware_version: firmwareVersion || '1.0.0',
        },
        {
          timeout: 10000,
        }
      );

      if (response.data.success) {
        console.log('Device claimed successfully!');
        const mqttBroker = response.data.mqtt_broker
          || response.data.configuration?.mqtt_broker;
        const mqttPort = response.data.mqtt_port
          || response.data.configuration?.mqtt_port
          || 1883;
        const brokerUrl = mqttBroker
          ? `mqtt://${mqttBroker}:${mqttPort}`
          : CONFIG.brokerUrl;

        return {
          success: true,
          device_id: response.data.device_id,
          business_id: response.data.business_id,
          configuration: response.data.configuration,
          broker_url: brokerUrl,
        };
      } else {
        console.error('Claim failed:', response.data.message);
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      console.error('Claim device error:', error.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Get device configuration (for already provisioned devices)
  async getDeviceConfig(deviceId) {
    try {
      const response = await axios.get(
        `${this.backendUrl}/provision/device-config/${deviceId}`,
        { timeout: 5000 }
      );
      
      if (response.data.success) {
        return {
          success: true,
          configuration: response.data.configuration,
        };
      }
      return { success: false, error: response.data.message };
    } catch (error) {
      if (error.response?.status === 404) {
        return { 
          success: false, 
          error: 'Device not found. Please re-provision.',
          notFound: true 
        };
      }
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Get MAC address (simulated)
  getMacAddress() {
    // Generate a consistent MAC based on hostname or random
    const crypto = require('crypto');
    const hostname = require('os').hostname();
    const hash = crypto.createHash('sha256').update(hostname).digest('hex');
    return `AA:BB:CC:${hash.substring(0, 2).toUpperCase()}:${hash.substring(2, 4).toUpperCase()}:${hash.substring(4, 6).toUpperCase()}`;
  }
}

// ── ESP32 Simulator State ──
class ESP32Simulator {
  constructor() {
    this.deviceId = null;
    this.businessId = null;
    this.client = null;
    this.interval = null;
    // this.state = this.getInitialState();
    this.configManager = new ConfigManager(CONFIG.configFile);
    this.provisioningService = new ProvisioningService(CONFIG.backendUrl);
  }

  // getInitialState() {
  //   return {
  //     energy_kwh: 0,
  //     run_seconds: 0,
  //     lastResetDay: null,
  //     rooms: {
  //       relay_1: { occupied: true, name: 'Office(AC and Lighting)' },
  //       relay_2: { occupied: false, name: 'Printing Room(Machine)' },
  //       relay_3: { occupied: true, name: 'Woking Room(Monitor)' },
  //       relay_4: { occupied: false, name: 'Server Room( server)' },
  //     },
  //     relays: {
  //       relay_1: 'ON',
  //       relay_2: 'OFF',
  //       relay_3: 'OFF',
  //       relay_4: 'ON',
  //     },
  //   };
  // }

  // ── Fetch rooms config from backend ──
  async fetchRoomsConfig() {
    try {
      const response = await axios.get(
        `${CONFIG.backendUrl}/rooms/device/${this.deviceId}`,
        { timeout: 5000 }
      );

      const rooms = response.data.rooms || [];

if (rooms.length === 0) {
        console.log('No rooms configured on backend for this device.');
        if (!this.state) {
          this.state = {
            energy_kwh: 0,
            run_seconds: 0,
            lastResetDay: null,
            rooms: {},
            relays: {},
          };
        } else {
          this.state.rooms = {};
          this.state.relays = {};
        }
        return;
      }

      const newRooms = {};
      const newRelays = {};

rooms.forEach(room => {
        const relayId = room.relay_id;
        const existing = this.state?.rooms?.[relayId];
        newRooms[relayId] = {
          occupied: room.occupied ?? false,
          name: room.name || relayId,
          // Each room keeps a stable "personality" once assigned, so behavior
          // doesn't reshuffle every refresh — busy rooms stay busy.
          activity: existing?.activity ?? (0.3 + Math.random() * 0.7),
        };
        newRelays[relayId] = room.relay_status || 'OFF';
      });

      if (!this.state) {
        // first fetch — build full state
        this.state = {
          energy_kwh: 0,
          run_seconds: 0,
          lastResetDay: null,
          rooms: newRooms,
          relays: newRelays,
        };
        console.log(`Loaded ${rooms.length} room(s) from backend`);
      } else {
        // later refresh — merge in new rooms, keep existing energy/run data
        this.state.rooms = { ...this.state.rooms, ...newRooms };
        this.state.relays = { ...this.state.relays, ...newRelays };
        console.log(`Refreshed rooms config (${rooms.length} room(s))`);
      }
    } catch (error) {
      console.error('Failed to fetch rooms config:', error.message);
      if (!this.state) {
        this.state = {
          energy_kwh: 0,
          run_seconds: 0,
          lastResetDay: null,
          rooms: {},
          relays: {},
        };
      }
    }
  }

  // ── Main startup ──
  async start() {
    console.log('\n🚀 ESP32 Simulator Starting...\n');
    console.log(__dirname);

    // Check if we have saved configuration in the config file
    const hasConfig = this.configManager.load();

    if (CLI_SETUP_CODE) {
      if (hasConfig) {
        console.log('Setup code supplied - replacing saved simulator device link.');
        this.configManager.delete();
      }
      await this.provision();
    } else if (!hasConfig) {
      // Enter provisioning mode
      await this.provision();
    } else {
      // Use saved config
      this.deviceId = this.configManager.getDeviceId();
      this.businessId = this.configManager.getBusinessId();
      
      console.log(`Device ID: ${this.deviceId}`);
      console.log(`Business ID: ${this.businessId}`);

      // Verify device still exists
      console.log('Verifying device configuration...');
      const verifyResult = await this.provisioningService.getDeviceConfig(this.deviceId);
      
      if (!verifyResult.success || verifyResult.notFound) {
        console.log(`${verifyResult.error || 'Device verification failed'}`);
        console.log('Re-provisioning required...');
        
        // Delete old config
        this.configManager.delete();
        
        // Start provisioning 253391
        await this.provision();
        return;
      }
      
      console.log('Device verified successfully');
      
      // Update any changed settings
      if (verifyResult.configuration) {
        console.log('Configuration loaded');
        if (verifyResult.configuration.settings) {
          console.log(` Voltage limits: ${verifyResult.configuration.settings.voltage_min}V - ${verifyResult.configuration.settings.voltage_max}V`);
          console.log(` Daily limit: ${verifyResult.configuration.settings.daily_kwh_limit}kWh`);
        }
      }
    }

    // Start MQTT and monitoring
    // Load rooms config from backend before starting
    await this.fetchRoomsConfig();

    // Start MQTT and monitoring
    this.startMonitoring();
  }

  // ── Provisioning Mode ──
  async provision() {
    console.log('\n Entering Provisioning Mode...');
    console.log('Generate a setup code from the AEMS dashboard (Devices → Connect ESP32).\n');
    console.log('Tip: pass --setup-code 123456 to skip the prompt.\n');

    let attempts = 0;
    const maxAttempts = CLI_SETUP_CODE ? 1 : 3;

    while (attempts < maxAttempts) {
      attempts++;

      const setupCode = CLI_SETUP_CODE || await askQuestion(`Enter 6-digit setup code (attempt ${attempts}/${maxAttempts}): `);
      
      if (!setupCode || !/^\d{6}$/.test(setupCode)) {
        console.log(' Invalid code format. Must be exactly 6 digits.\n');
        continue;
      }

      // Claim device
      const result = await this.provisioningService.claimDevice(setupCode);
      
      if (result.success) {
        this.deviceId = result.device_id;
        this.businessId = result.business_id;
        
        // Save configuration
        this.configManager.save(this.deviceId, this.businessId, {
          claimed_at: new Date().toISOString(),
          broker_url: result.broker_url,
        });

        console.log(`\nDevice successfully provisioned!`);
        console.log(`  Device ID: ${this.deviceId}`);
        console.log(`  Business ID: ${this.businessId}`);
        console.log(`  MQTT: ${result.broker_url}`);
        console.log('  Configuration saved for future runs\n');

        if (!CLI_SETUP_CODE) {
          rl.close();
        }
        return;
      } else {
        console.log(`Provisioning failed: ${result.error || 'Unknown error'}`);
        console.log('   Please check:');
        console.log('   1. The setup code is correct');
        console.log('   2. The code hasn\'t expired (15 minutes)');
        console.log('   3. The code hasn\'t been used already\n');
      }
    }

    console.log(' Too many failed attempts. Exiting.');
    if (!CLI_SETUP_CODE) {
      rl.close();
    }
    process.exit(1);
  }

  getMqttBrokerUrl() {
    return this.configManager.getBrokerUrl();
  }

  // ── Start Monitoring ──
startMonitoring() {
    this.connectMQTT();

    // Refresh rooms config every 60 seconds to pick up new rooms
    this.roomsRefreshInterval = setInterval(() => {
      this.fetchRoomsConfig();
    }, 60000);
  }

  // ── MQTT Connection ──
  connectMQTT() {
    const brokerUrl = this.getMqttBrokerUrl();
    console.log(`Connecting to MQTT broker: ${brokerUrl}`);
    console.log(`Device: ${this.deviceId}\n`);

    this.client = mqtt.connect(brokerUrl, {
      clientId: `esp32-${this.deviceId}-${Date.now()}`,
      clean: true,
    });

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker\n');

      // Send online status
      this.client.publish(
        `aems/${this.deviceId}/status`,
        JSON.stringify({ 
          status: 'online', 
          device_id: this.deviceId,
          business_id: this.businessId,
        }),
        { qos: 1 }
      );

      // Subscribe to commands
      this.client.subscribe(`aems/${this.deviceId}/commands`, (err) => {
        if (err) {
          console.error('Failed to subscribe to commands:', err.message);
        } else {
          console.log('Subscribed to commands');
        }
      });

      // Start sending readings
      console.log(`Sending readings every ${CONFIG.intervalMs/1000} seconds\n`);
      this.interval = setInterval(() => {
        this.sendReading();
      }, CONFIG.intervalMs);
    });

    // Handle incoming commands
    this.client.on('message', (topic, message) => {
      if (topic.includes('/commands')) {
        try {
          const command = JSON.parse(message.toString());
          console.log(`\n📨 COMMAND RECEIVED:`, command);

          if (command.relay_id && (command.status || command.action)) {
            const status = command.status || command.action;
            this.state.relays[command.relay_id] = status;
            console.log(`   -> ${command.relay_id} set to ${status}\n`);
          }
        } catch (error) {
          console.error(' Failed to parse command:', error.message);
        }
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT connection error:', err.message);
    });

    this.client.on('close', () => {
      console.log('🔌 MQTT connection closed');
    });
  }

  // ── Send Reading ──
  sendReading() {
    if (!this.client || !this.client.connected) {
      console.log('MQTT not connected, waiting...');
      return;
    }


    this.state.run_seconds += CONFIG.intervalMs / 1000;
    this.resetDailyIfNewDay();

    // Simulate occupancy changes
    this.simulateOccupancyChanges();

    // Build reading
    const reading = this.buildReading();
    const topic = `aems/${this.deviceId}/readings`;
    const payload = JSON.stringify(reading);

    this.client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error('Publish error:', err.message);
        return;
      }

      // Calculate stats
      const occupied = Object.values(this.state.rooms)
        .filter(r => r.occupied).length;
      
      console.log(`Reading | V: ${reading.main.voltage}V | P: ${reading.main.power}W | kWh: ${reading.main.energy_kwh.toFixed(3)} | Rooms: ${occupied}/4`);
    });
  }

  // ── Helper Functions (same as before) ──
  resetDailyIfNewDay() {
    const today = new Date().toDateString();
    if (this.state.lastResetDay && this.state.lastResetDay !== today) {
      console.log('New day detected — resetting energy counter');
      this.state.energy_kwh = 0;
    }
    this.state.lastResetDay = today;
  }

  generateVoltage() {
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    const base = isPeakHour ? 205 : 218;
    const noise = (Math.random() - 0.5) * 10;
    return Math.round((base + noise) * 10) / 10;
  }

  generateCurrent(rooms, relays) {
    let total = 0;
    if (relays.relay_1 === 'ON') total += rooms.relay_1?.occupied ? 3.2 : 0.1;
    if (relays.relay_2 === 'ON') total += rooms.relay_2?.occupied ? 4.8 : 0.1;
    if (relays.relay_3 === 'ON') total += rooms.relay_3?.occupied ? 2.1 : 0.1;
    if (relays.relay_4 === 'ON') total += 1.8;
    total += (Math.random() - 0.5) * 0.3;
    return Math.round(Math.max(0.1, total) * 100) / 100;
  }

generateRoomCurrents(rooms, relays) {
  const result = {};

  for (const [relayId, room] of Object.entries(rooms)) {
    const relayOn = relays[relayId] === 'ON';

    let current = 0;
    if (relayOn) {
      current = room.occupied ? (1.5 + Math.random() * 2) : 0.05;
      if (relayId === 'relay_4') current = 1.8 + Math.random() * 0.3;
    }

    result[relayId] = {
      relay: relayId,
      name: room.name,
      occupied: room.occupied,
      current_a: Math.round(current * 100) / 100,
      relay_status: relayOn ? 'ON' : 'OFF',
    };
  }
  return result;
}

simulateOccupancyChanges() {
    const hour = new Date().getHours();
    // Work hours skew rooms toward occupied; nights/early morning skew toward empty.
    const isWorkHours = hour >= 7 && hour <= 19;
    const timeBias = isWorkHours ? 1.3 : 0.4;

    for (const [relayId, room] of Object.entries(this.state.rooms)) {
      const activity = room.activity ?? 0.5;

      // Occupied rooms are "stickier" — less likely to suddenly go empty
      // than an empty room is to suddenly become occupied (when it's busy hours).
      const flipChance = room.occupied
        ? 0.04 * activity
        : 0.08 * activity * timeBias;

      if (Math.random() < flipChance) {
        this.state.rooms[relayId].occupied = !room.occupied;
        this.state.relays[relayId] = this.state.rooms[relayId].occupied ? 'ON' : 'OFF';
      }
              const status = this.state.rooms[relayId].occupied ? 'OCCUPIED' : 'EMPTY';
        console.log(`${room.name} → ${status}`);
    }
  }

  buildReading() {
    const voltage = this.generateVoltage();
    const current = this.generateCurrent(this.state.rooms, this.state.relays);
    const power = Math.round(voltage * current * 0.89 * 10) / 10;
    const newKwh = power * (CONFIG.intervalMs / 1000) / 3600;
    this.state.energy_kwh = Math.round((this.state.energy_kwh + newKwh) * 1000) / 1000;

    return {
      device_id: this.deviceId,
      business_id: this.businessId,
      timestamp: new Date().toISOString(),
      main: {
        voltage: voltage,
        current: current,
        power: power,
        energy_kwh: this.state.energy_kwh,
        frequency: 49.98 + (Math.random() - 0.5) * 0.1,
        power_factor: 0.87 + Math.random() * 0.05,
      },
      rooms: this.generateRoomCurrents(this.state.rooms, this.state.relays),
      relays: { ...this.state.relays },
    };
  }

  // ── Clean Shutdown ──
  shutdown() {
    console.log('\n\nStopping simulator...');
    
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.roomsRefreshInterval) {
      clearInterval(this.roomsRefreshInterval);
    }

    if (this.client && this.client.connected) {
      // Send offline status
      this.client.publish(
        `aems/${this.deviceId}/status`,
        JSON.stringify({ 
          status: 'offline', 
          device_id: this.deviceId,
          business_id: this.businessId,
        }),
        { qos: 1 },
        () => {
          this.client.end();
          console.log('Simulator stopped cleanly');
          process.exit(0);
        }
      );
    } else {
      console.log('Simulator stopped');
      process.exit(0);
    }
  }
}

// ── MAIN ──
const simulator = new ESP32Simulator();

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  simulator.shutdown();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  simulator.shutdown();
});

// Start the simulator
simulator.start().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
