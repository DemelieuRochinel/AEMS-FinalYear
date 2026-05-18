//  ESP32 SIMULATOR
//  Simulates real ESP32 hardware sending sensor data
//  Used for backend development without physical hardware

//  Simulates:
//  → PZEM-004T energy meter readings
//  → PIR motion sensor occupancy changes
//  → ACS712 per-room current readings
//  → Relay states
//  → Voltage fluctuations (Cameroon ENEO reality)
//
//  Run: node src/test/simulateESP32.js

const mqtt = require('mqtt');
require('dotenv').config();

//Simulator configuration
const CONFIG = {
  brokerUrl:    process.env.MQTT_BROKER_URL,
  deviceId:     'device_BUEA001',
  businessId:   'business_demo_001',
  intervalMs:   5000,    // send reading every 5 seconds
  clientId:     `esp32-simulator-${Date.now()}`,
};

// Simulated state (changes over time like real hardware)
let state = {
  // Energy meter — cumulative kWh increases over time
  energy_kwh:    0,
  run_seconds:   0,

  // Room occupancy — changes randomly
  rooms: {
    room_1: { occupied: true,  name: 'Main Office'  },
    room_2: { occupied: false, name: 'Meeting Room' },
    room_3: { occupied: true,  name: 'Reception'    },
    room_4: { occupied: false, name: 'Server Room'  },
  },

  // Relay states — match room occupancy
  relays: {
    relay_1: 'ON',
    relay_2: 'OFF',
    relay_3: 'ON',
    relay_4: 'ON',  // Server room always ON (no auto-shutdown)
  },
};

//  HELPERS — Generate realistic sensor values
``
// Voltage fluctuates like real ENEO supply in Cameroon
const generateVoltage = () => {
  const hour = new Date().getHours();

  // Peak hours (morning 7-9, evening 17-20) voltage drops
  const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);

  const base  = isPeakHour ? 205 : 218;
  const noise = (Math.random() - 0.5) * 10;

  return Math.round((base + noise) * 10) / 10;
};

// Current depends on which rooms are occupied
const generateCurrent = (rooms, relays) => {
  let total = 0;
  if (relays.relay_1 === 'ON') total += rooms.room_1.occupied ? 3.2 : 0.1;
  if (relays.relay_2 === 'ON') total += rooms.room_2.occupied ? 4.8 : 0.1;
  if (relays.relay_3 === 'ON') total += rooms.room_3.occupied ? 2.1 : 0.1;
  if (relays.relay_4 === 'ON') total += 1.8; // servers always consume
  total += (Math.random() - 0.5) * 0.5; // small noise
  return Math.round(Math.max(0.5, total) * 100) / 100;
};

// Per-room current from ACS712
const generateRoomCurrents = (rooms, relays) => {
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
      occupied:  room.occupied,
      current_a: Math.round(current * 100) / 100,
    };
  }
  return result;
};

// Simulate PIR occupancy changes (people come and go)
const simulateOccupancyChanges = () => {
  // Each room has 10% chance of changing occupancy every reading
  for (const [roomId, room] of Object.entries(state.rooms)) {
    if (roomId === 'room_4') continue; // server room never changes

    if (Math.random() < 0.10) {
      state.rooms[roomId].occupied = !room.occupied;

      // Relay follows occupancy
      const relayMap = {
        room_1: 'relay_1',
        room_2: 'relay_2',
        room_3: 'relay_3',
      };
      const relayId = relayMap[roomId];
      if (relayId) {
        state.relays[relayId] = state.rooms[roomId].occupied ? 'ON' : 'OFF';
      }

      const status = state.rooms[roomId].occupied ? 'OCCUPIED' : 'EMPTY';
      console.log(`\${room.name} → ${status}`);
    }
  }
};

// Build the complete reading payload
const buildReading = () => {
  state.run_seconds += CONFIG.intervalMs / 1000;

  // Energy accumulates realistically (kWh = W × h / 1000)
  const voltage  = generateVoltage();
  const current  = generateCurrent(state.rooms, state.relays);
  const power    = Math.round(voltage * current * 0.89 * 10) / 10;
  const newKwh   = power * (CONFIG.intervalMs / 1000) / 3600;
  state.energy_kwh = Math.round((state.energy_kwh + newKwh) * 1000) / 1000;

  return {
    device_id:   CONFIG.deviceId,
    business_id: CONFIG.businessId,
    timestamp:   new Date().toISOString(),

    main: {
      voltage:      voltage,
      current:      current,
      power:        power,
      energy_kwh:   state.energy_kwh,
      frequency:    49.98 + (Math.random() - 0.5) * 0.1,
      power_factor: 0.87 + Math.random() * 0.05,
    },

    rooms:  generateRoomCurrents(state.rooms, state.relays),
    relays: { ...state.relays },
  };
};

//  MAIN — Connect and start publishing
const client = mqtt.connect(CONFIG.brokerUrl, {
  clientId: CONFIG.clientId,
  clean:    true,
});

client.on('connect', () => {
  console.log('Simulator connected to MQTT broker\n');

  // Send online status immediately
  client.publish(
    `aems/${CONFIG.deviceId}/status`,
    JSON.stringify({ status: 'online', device_id: CONFIG.deviceId }),
    { qos: 1 }
  );

  let readingCount = 0;

  // Send reading every 5 seconds
  const interval = setInterval(() => {
    simulateOccupancyChanges();

    const reading = buildReading();
    const topic   = `aems/${CONFIG.deviceId}/readings`;
    const payload = JSON.stringify(reading);

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(' Publish error:', err.message);
        return;
      }

      readingCount++;
      const occupied = Object.values(state.rooms)
        .filter(r => r.occupied).length;

      console.log(
        ` Reading #${readingCount} sent | ` +
        `V: ${reading.main.voltage}V | ` +
        `P: ${reading.main.power}W | ` +
        `kWh: ${reading.main.energy_kwh} | ` +
        `Rooms: ${occupied}/4 occupied`
      );
    });
  }, CONFIG.intervalMs);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n Stopping simulator...');
    clearInterval(interval);

    // Send offline status before disconnecting
    client.publish(
      `aems/${CONFIG.deviceId}/status`,
      JSON.stringify({ status: 'offline', device_id: CONFIG.deviceId }),
      { qos: 1 },
      () => {
        client.end();
        console.log('Simulator stopped cleanly');
        process.exit(0);
      }
    );
  });
});

client.on('error', (err) => {
  console.error(' Simulator connection error:', err.message);
  console.error('   Make sure Mosquitto is running: net start mosquitto');
  process.exit(1);
});

// Listen for commands coming back from backend
client.on('message', (topic, message) => {
  if (topic.includes('/commands')) {
    const command = JSON.parse(message.toString());
    console.log(`\n COMMAND RECEIVED:`, command);

    // Update relay state to reflect command
    if (command.relay_id && command.action) {
      state.relays[command.relay_id] = command.action;
      console.log(`   → ${command.relay_id} set to ${command.action}\n`);
    }
  }
});

client.subscribe(`aems/${CONFIG.deviceId}/commands`);