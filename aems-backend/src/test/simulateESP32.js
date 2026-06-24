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

// ── Configuration ──
const CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000/api',
  intervalMs: 5000, // send reading every 5 seconds
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
        return {
          success: true,
          device_id: response.data.device_id,
          business_id: response.data.business_id,
          configuration: response.data.configuration,
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
    this.state = this.getInitialState();
    this.configManager = new ConfigManager(CONFIG.configFile);
    this.provisioningService = new ProvisioningService(CONFIG.backendUrl);
  }

  getInitialState() {
    return {
      energy_kwh: 0,
      run_seconds: 0,
      lastResetDay: null,
      rooms: {
        room_1: { occupied: true, name: 'Main Office' },
        room_2: { occupied: false, name: 'Meeting Room' },
        room_3: { occupied: true, name: 'Reception' },
        room_4: { occupied: false, name: 'Server Room' },
      },
      relays: {
        relay_1: 'ON',
        relay_2: 'OFF',
        relay_3: 'ON',
        relay_4: 'OFF',
      },
    };
  }

  // ── Main startup ──
  async start() {
    console.log('\n🚀 ESP32 Simulator Starting...\n');

    // Check if we have saved configuration
    const hasConfig = this.configManager.load();

    if (!hasConfig) {
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
        
        // Start provisioning
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
    this.startMonitoring();
  }

  // ── Provisioning Mode ──
  async provision() {
    console.log('\n Entering Provisioning Mode...');
    console.log('Please go to your AEMS dashboard and generate a setup code for a device.');
    console.log('   (Business: Create Account → Device Profile → Generate Setup Code)\n');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      
      // Ask for setup code
      const setupCode = await askQuestion(`📱 Enter 6-digit setup code (attempt ${attempts}/${maxAttempts}): `);
      
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
        });
        
        console.log(`\n✅ Device successfully provisioned!`);
        console.log(`  Device ID: ${this.deviceId}`);
        console.log(`  Business ID: ${this.businessId}`);
        console.log('   Configuration saved for future runs\n');
        
        rl.close();
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
    rl.close();
    process.exit(1);
  }

  // ── Start Monitoring ──
  startMonitoring() {
    this.connectMQTT();
  }

  // ── MQTT Connection ──
  connectMQTT() {
    console.log(`Connecting to MQTT broker: ${CONFIG.brokerUrl}`);
    console.log(`Device: ${this.deviceId}\n`);

    this.client = mqtt.connect(CONFIG.brokerUrl, {
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

          if (command.relay_id && command.action) {
            this.state.relays[command.relay_id] = command.action;
            console.log(`   → ${command.relay_id} set to ${command.action}\n`);
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
    if (relays.relay_1 === 'ON') total += rooms.room_1.occupied ? 3.2 : 0.1;
    if (relays.relay_2 === 'ON') total += rooms.room_2.occupied ? 4.8 : 0.1;
    if (relays.relay_3 === 'ON') total += rooms.room_3.occupied ? 2.1 : 0.1;
    if (relays.relay_4 === 'ON') total += 1.8;
    total += (Math.random() - 0.5) * 0.3;
    return Math.round(Math.max(0.1, total) * 100) / 100;
  }

generateRoomCurrents(rooms, relays) {
  const result = {};
  const roomRelayMap = {
    room_1: 'relay_1',
    room_2: 'relay_2',
    room_3: 'relay_3',
    room_4: 'relay_4',
  };

  for (const [roomId, room] of Object.entries(rooms)) {
    const relayId = roomRelayMap[roomId];
    const relayOn = relays[relayId] === 'ON';

    let current = 0;
    if (relayOn) {
      current = room.occupied ? (1.5 + Math.random() * 2) : 0.05;
      if (roomId === 'room_4') current = 1.8 + Math.random() * 0.3;
    }

    result[roomId] = {
      name: room.name,
      occupied: room.occupied,
      current_a: Math.round(current * 100) / 100,
      // ── ✅ NEW: Include relay status ──
      relay_status: relayOn ? 'ON' : 'OFF',
    };
  }
  return result;
}

  simulateOccupancyChanges() {
    for (const [roomId, room] of Object.entries(this.state.rooms)) {
      if (roomId === 'room_4') continue;

      if (Math.random() < 0.10) {
        this.state.rooms[roomId].occupied = !room.occupied;

        const relayMap = {
          room_1: 'relay_1',
          room_2: 'relay_2',
          room_3: 'relay_3',
        };
        const relayId = relayMap[roomId];
        if (relayId) {
          this.state.relays[relayId] = this.state.rooms[roomId].occupied ? 'ON' : 'OFF';
        }

        const status = this.state.rooms[roomId].occupied ? 'OCCUPIED' : 'EMPTY';
        console.log(`👤 ${room.name} → ${status}`);
      }
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