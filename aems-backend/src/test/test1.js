// ═══════════════════════════════════════════════════════════
//  SPRINT 2 TEST SUITE — MQTT + Firebase Pipeline
//
//  HOW THIS TEST WORKS:
//  1. Connects directly to MQTT broker
//  2. Publishes a fake ESP32 reading
//  3. Waits for backend to receive and process it
//  4. Verifies reading was saved in Firebase
//  5. Cleans up test data
//
//  REQUIREMENTS:
//  → Mosquitto running: net start mosquitto
//  → Backend running:   npm run dev (in another terminal)
//  → Run test:          node src/test/sprint2.test.js
// ═══════════════════════════════════════════════════════════

const mqtt = require('mqtt');
require('dotenv').config();

const db              = require('../config/firebase');
const readingsService = require('../services/readingsService');
const deviceService   = require('../services/deviceService');
const alertsService   = require('../services/alertsService');
const businessService = require('../services/businessService');

// ── Test identifiers ────────────────────────────────────────
const TEST = {
  businessId: 'test_mqtt_business_001',
  deviceId:   'test_mqtt_device_001',
  clientId:   `test-client-${Date.now()}`,
};

let passed = 0;
let failed = 0;

const pass = (name, detail = '') => {
  passed++;
  console.log(`PASS  ${name}${detail ? ' — ' + detail : ''}`);
};

const fail = (name, reason) => {
  failed++;
  console.log(`FAIL  ${name} — ${reason}`);
};

const section = (title) => {
  console.log(`\n  ── ${title} ${'─'.repeat(40 - title.length)}`);
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║         AEMS — SPRINT 2 TEST SUITE                   ║');
  console.log('║         MQTT + Firebase Pipeline                     ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  // Setup test business and device
  section('Setup');
  try {
    await businessService.createBusiness(TEST.businessId, {
      name:        'MQTT Test Business',
      owner_name:  'Test Owner',
      owner_email: 'test@mqtt.com',
      location:    'Test Location',
    });
    pass('Created test business');

    await deviceService.createDevice(TEST.deviceId, {
      business_id: TEST.businessId,
      device_name: 'MQTT Test Device',
    });
    pass('Created test device');
  } catch (err) {
    fail('Setup', err.message);
    await cleanup();
    process.exit(1);
  }

  //Test 1: MQTT broker connectivity
  section('MQTT Broker Connection');
  const mqttClient = await testMqttConnection();
  if (!mqttClient) {
    console.log('\n Cannot connect to MQTT broker');
    console.log('  → Run: net start mosquitto');
    await cleanup();
    process.exit(1);
  }
  pass('Connected to MQTT broker at localhost:1883');

  //Test 2: Publish reading and verify in Firebase 
  section('MQTT → Firebase Pipeline');

  const testReading = {
    device_id:   TEST.deviceId,
    business_id: TEST.businessId,
    timestamp:   new Date().toISOString(),
    main: {
      voltage:      219.5,
      current:      7.8,
      power:        1523.4,
      energy_kwh:   5.234,
      frequency:    50.01,
      power_factor: 0.88,
    },
    rooms: {
      room_1: { occupied: true,  current_a: 2.3 },
      room_2: { occupied: false, current_a: 0.0 },
    },
    relays: {
      relay_1: 'ON',
      relay_2: 'OFF',
    },
  };

  // Publish to MQTT
  const topic = `aems/${TEST.deviceId}/readings`;
  mqttClient.publish(topic, JSON.stringify(testReading), { qos: 1 });
  console.log(`Published reading to: ${topic}`);

  // Wait for backend to process (backend receives → saves to Firebase)
  console.log('Waiting 3 seconds for backend to process...');
  await wait(3000);

  // Verify reading saved in Firebase
  try {
    const saved = await readingsService.getLatestReading(TEST.businessId);
    if (saved && saved.main.voltage === 219.5) {
      pass('Reading saved to Firebase', `voltage: ${saved.main.voltage}V`);
    } else {
      fail('Reading in Firebase',
        `Is your backend running? (npm run dev)\nExpected 219.5V, got ${saved?.main?.voltage}`
      );
    }
  } catch (err) {
    fail('Reading verification', err.message);
  }

  //Test 3: Device marked online
  section('Device Status Tracking');
  try {
    // Publish online status
    mqttClient.publish(
      `aems/${TEST.deviceId}/status`,
      JSON.stringify({ status: 'online', device_id: TEST.deviceId }),
      { qos: 1 }
    );
    await wait(2000);

    const device = await deviceService.getDeviceById(TEST.deviceId);
    if (device && device.is_online === true) {
      pass('Device marked online after status message');
    } else {
      fail('Device online status', 'device not marked online — is backend running?');
    }
  } catch (err) {
    fail('Device status', err.message);
  }

  //Test 4: Command publishing
  section('Command Publishing (Backend → ESP32)');
  try {
    const { publishCommand } = require('../Services/mqttService');

    if (typeof publishCommand === 'function') {
      pass('publishCommand function exists');
    } else {
      fail('publishCommand', 'function not exported');
    }
  } catch (err) {
    fail('Command publisher', err.message);
  }

  //Test 5: Voltage alert creation
  section('Voltage Alert Creation');
  try {
    // Publish a reading with low voltage
    const lowVoltageReading = {
      ...testReading,
      main: { ...testReading.main, voltage: 175.0 },
    };

    mqttClient.publish(
      `aems/${TEST.deviceId}/readings`,
      JSON.stringify(lowVoltageReading),
      { qos: 1 }
    );
    await wait(2000);

    const alerts = await alertsService.getAlertHistory(TEST.businessId);
    const voltageAlert = alerts.find(a => a.type === 'low_voltage');

    if (voltageAlert) {
      pass('Low voltage alert created', `value: ${voltageAlert.value}V`);
    } else {
      fail('Voltage alert', 'no low_voltage alert found — check mqttService._checkVoltageAlerts');
    }
  } catch (err) {
    fail('Voltage alert', err.message);
  }

  // Cleanup 
  //  mqttClient.end();
  await cleanup();

  // Results
  console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
  if (failed === 0) {
    console.log(`║ ALL ${passed + failed} TESTS PASSED                   ║`);
    console.log('║  Sprint 2 complete — MQTT pipeline is working         ║');
    console.log('║  Ready for Sprint 3 — REST API Layer                  ║');
  } else {
    console.log(`║  Results: ${passed} passed   ${failed} failed         ║`);
    console.log('║ Fix failures before Sprint 3                          ║');
  }
    console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

async function testMqttConnection() {
  return new Promise((resolve) => {
    const client = mqtt.connect('mqtt://localhost:1883', {
      clientId:       `sprint2-test-${Date.now()}`,
      connectTimeout: 5000,
    });

    const timeout = setTimeout(() => {
      client.end();
      resolve(null);
    }, 5000);

    client.on('connect', () => {
      clearTimeout(timeout);
      resolve(client);
    });

    client.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

async function cleanup() {
  section('Cleanup');
  try {
    await db.ref(`businesses/${TEST.businessId}`).remove();
    await db.ref(`devices/${TEST.deviceId}`).remove();
    await db.ref(`readings/${TEST.businessId}`).remove();
    await db.ref(`alerts/${TEST.businessId}`).remove();
    console.log(' Test data cleaned from Firebase');
  } catch (err) {
    console.log('Cleanup warning:', err.message);
  }
}

runTests().catch(console.error);