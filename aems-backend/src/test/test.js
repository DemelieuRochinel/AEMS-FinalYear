
require('dotenv').config();

// Import all services 
const db              = require('../config/firebase');
const businessService = require('../services/businessService');
const deviceService   = require('../services/deviceService');
const roomService     = require('../services/roomService');
const readingsService = require('../services/readingsService');
const alertsService   = require('../services/alertsService');
const userService     = require('../services/userService');
const reportService   = require('../services/reportService');

//Test data IDs — all prefixed with test_
const IDs = {
  business: 'test_business_AEMS001',
  device:   'test_device_BUEA001',
  user:     'test_user_owner001',
};

//Test result counters
let passed = 0;
let failed = 0;
let total  = 0;

//Test helpers 
const pass = (testName, detail = '') => {
  passed++;
  total++;
  console.log(`PASS  ${testName}${detail ? ' — ' + detail : ''}`);
};

const fail = (testName, reason) => {
  failed++;
  total++;
  console.log(`FAIL  ${testName} — ${reason}`);
};

const section = (title) => {
  console.log('');
  console.log(`  ── ${title} ${'─'.repeat(45 - title.length)}`);
};

//  TEST 1 — FIREBASE CONNECTION
async function testFirebaseConnection() {
  section('Firebase Connection');
  try {
    // Write a simple ping value
    await db.ref('test_ping').set({
      message:   'AEMS connection test',
      timestamp: new Date().toISOString(),
    });

    // Read it back
    const snap = await db.ref('test_ping').once('value');
    if (snap.exists() && snap.val().message === 'AEMS connection test') {
      pass('Firebase read/write', 'ping successful');
    } else {
      fail('Firebase read/write', 'value not found after write');

    }

    // Clean up ping
    await db.ref('test_ping').remove();

  } catch (err) {
    fail('Firebase connection', err.message);
  }
}

// //  TEST 2 — BUSINESS SERVICE
async function testBusinessService() {
  section('Business Service');
  try {
    // CREATE
    const created = await businessService.createBusiness(IDs.business, {
      name:        'Ngozi Enterprise — Test',
      owner_name:  'Jean-Baptiste Mbarga',
      owner_phone: '+237 691 234 567',
      owner_email: 'jb.mbarga@test.com',
      location:    'Douala, Littoral Region',
      business_type: 'Office',
      settings: {
        daily_kwh_limit: 50,
        voltage_min:     190,
        voltage_max:     220,
      },
    });
    pass('createBusiness', `ID: ${created.businessId}`);

    // READ by ID
    const fetched = await businessService.getBusinessById(IDs.business);
    if (fetched && fetched.name === 'Ngozi Enterprise — Test') {
      pass('getBusinessById', `name: "${fetched.name}"`);
    } else {
      fail('getBusinessById', 'name does not match');
    }

    // READ settings
    const settings = await businessService.getBusinessSettings(IDs.business);
    if (settings && settings.daily_kwh_limit === 50) {
      pass('getBusinessSettings', `daily limit: ${settings.daily_kwh_limit} kWh`);
    } else {
      fail('getBusinessSettings', 'settings not found');
    }

    // UPDATE settings
    await businessService.updateBusinessSettings(IDs.business, {
      daily_kwh_limit: 75,
    });
    const updated = await businessService.getBusinessSettings(IDs.business);
    if (updated.daily_kwh_limit === 75) {
      pass('updateBusinessSettings', `new limit: ${updated.daily_kwh_limit} kWh`);
    } else {
      fail('updateBusinessSettings', 'value not updated');
    }

    // GET ALL
    const all = await businessService.getAllBusinesses();
    const found = all.find(b => b.id === IDs.business);
    if (found) {
      pass('getAllBusinesses', `found test business in ${all.length} total`);
    } else {
      fail('getAllBusinesses', 'test business not in list');
    }

  } catch (err) {
    fail('businessService', err.message);
  }
}

//  TEST 3 — DEVICE SERVICE
async function testDeviceService() {
  section('Device Service');
  try {
    // CREATE
    const created = await deviceService.createDevice(IDs.device, {
      business_id:  IDs.business,
      device_name:  'AEMS Unit — Test Office',
      location:     'Main Distribution Board',
      hardware: {
        has_pzem:    true,
        num_relays:  8,
        num_pir:     4,
        num_acs712:  4,
        has_sd_card: true,
      },
    });
    pass('createDevice', `ID: ${created.deviceId}`);

    // READ by ID
    const device = await deviceService.getDeviceById(IDs.device);
    if (device && device.device_name === 'AEMS Unit — Test Office') {
      pass('getDeviceById', `name: "${device.device_name}"`);
    } else {
      fail('getDeviceById', 'device not found');
    }

    // Starts offline
    if (device && device.is_online === false) {
      pass('Device starts offline', 'is_online: false');
    } else {
      fail('Device starts offline', 'should be false on creation');
    }

    // MARK ONLINE
    await deviceService.markDeviceOnline(IDs.device);
    const online = await deviceService.getDeviceById(IDs.device);
    if (online && online.is_online === true) {
      pass('markDeviceOnline', 'is_online: true');
    } else {
      fail('markDeviceOnline', 'device not marked online');
    }

    // MARK OFFLINE
    await deviceService.markDeviceOffline(IDs.device);
    const offline = await deviceService.getDeviceById(IDs.device);
    if (offline && offline.is_online === false) {
      pass('markDeviceOffline', 'is_online: false');
    } else {
      fail('markDeviceOffline', 'device not marked offline');
    }

    // GET BY BUSINESS
    await deviceService.markDeviceOnline(IDs.device);
    const devices = await deviceService.getDevicesByBusiness(IDs.business);
    if (devices.length > 0) {
      pass('getDevicesByBusiness', `found ${devices.length} device(s)`);
    } else {
      fail('getDevicesByBusiness', 'no devices found');
    }

  } catch (err) {
    fail('deviceService', err.message);
  }
}

//  TEST 4 — ROOM SERVICE
async function testRoomService() {
  section('Room Service');
  try {
    const testRooms = [
      { id: 'room_1', name: 'Main Office',  relay: 'relay_1', type: 'lights_and_fan',  auto: true  },
      { id: 'room_2', name: 'Meeting Room', relay: 'relay_2', type: 'ac_and_lights',   auto: true  },
      { id: 'room_3', name: 'Reception',    relay: 'relay_3', type: 'lights',           auto: true  },
      { id: 'room_4', name: 'Server Room',  relay: 'relay_4', type: 'servers',          auto: false },
    ];

    // CREATE all rooms
    for (const r of testRooms) {
      await roomService.createRoom(IDs.business, r.id, {
        device_id:    IDs.device,
        name:         r.name,
        relay_id:     r.relay,
        device_type:  r.type,
        auto_shutdown: r.auto,
      });
    }
    pass('createRoom x4', '4 rooms created');

    // GET ALL rooms
    const rooms = await roomService.getRoomsByBusiness(IDs.business);
    if (rooms.length === 4) {
      pass('getRoomsByBusiness', `found ${rooms.length} rooms`);
    } else {
      fail('getRoomsByBusiness', `expected 4, got ${rooms.length}`);
    }

    // UPDATE OCCUPANCY — room becomes occupied
    await roomService.updateRoomOccupancy(IDs.business, 'room_1', true);
    const r1 = await roomService.getRoomById(IDs.business, 'room_1');
    if (r1 && r1.occupied === true && r1.last_motion !== null) {
      pass('updateRoomOccupancy (occupied)', `last_motion set`);
    } else {
      fail('updateRoomOccupancy (occupied)', 'not updated correctly');
    }

    // UPDATE OCCUPANCY — room becomes empty
    await roomService.updateRoomOccupancy(IDs.business, 'room_2', false);
    const r2 = await roomService.getRoomById(IDs.business, 'room_2');
    if (r2 && r2.occupied === false && r2.empty_since !== null) {
      pass('updateRoomOccupancy (empty)', `empty_since set`);
    } else {
      fail('updateRoomOccupancy (empty)', 'empty_since not set');
    }

    // UPDATE RELAY STATUS
    await roomService.updateRelayStatus(IDs.business, 'room_2', 'OFF');
    const r2Updated = await roomService.getRoomById(IDs.business, 'room_2');
    if (r2Updated && r2Updated.relay_status === 'OFF') {
      pass('updateRelayStatus', `relay_2: OFF`);
    } else {
      fail('updateRelayStatus', 'status not updated');
    }

    // VERIFY server room has auto_shutdown = false
    const serverRoom = await roomService.getRoomById(IDs.business, 'room_4');
    if (serverRoom && serverRoom.auto_shutdown === false) {
      pass('Server room never auto-shuts down', 'auto_shutdown: false');
    } else {
      fail('Server room auto_shutdown', 'should be false');
    }

    // TOGGLE AUTO-SHUTDOWN
    await roomService.toggleAutoShutdown(IDs.business, 'room_1', false);
    const r1Toggle = await roomService.getRoomById(IDs.business, 'room_1');
    if (r1Toggle && r1Toggle.auto_shutdown === false) {
      pass('toggleAutoShutdown', 'auto_shutdown toggled to false');
    } else {
      fail('toggleAutoShutdown', 'toggle failed');
    }

  } catch (err) {
    fail('roomService', err.message);
  }
}

//  TEST 5 — READINGS SERVICE
async function testReadingsService() {
  section('Readings Service');
  try {
    const mockReading = {
      device_id: IDs.device,
      main: {
        voltage:      218.4,
        current:      8.2,
        power:        1789.5,
        energy_kwh:   12.847,
        frequency:    49.98,
        power_factor: 0.89,
      },
      rooms: {
        room_1: { occupied: true,  current_a: 2.1 },
        room_2: { occupied: false, current_a: 0.0 },
        room_3: { occupied: true,  current_a: 3.4 },
        room_4: { occupied: false, current_a: 1.8 },
      },
      relays: {
        relay_1: 'ON',
        relay_2: 'OFF',
        relay_3: 'ON',
        relay_4: 'ON',
      },
    };

    // SAVE reading
    const saved = await readingsService.saveReading(IDs.business, mockReading);
    pass('saveReading', `path: ${saved.path}`);

    // Wait 500ms for Firebase to process
    await new Promise(r => setTimeout(r, 500));

    // GET LATEST
    const latest = await readingsService.getLatestReading(IDs.business);
    if (latest && latest.main.voltage === 218.4) {
      pass('getLatestReading', `voltage: ${latest.main.voltage}V`);
    } else {
      fail('getLatestReading', `expected 218.4V, got ${latest?.main?.voltage}`);
    }

    // GET TODAY
    const today = await readingsService.getTodayReadings(IDs.business);
    if (today.length >= 1) {
      pass('getTodayReadings', `${today.length} reading(s) today`);
    } else {
      fail('getTodayReadings', 'no readings found');
    }

    // SAVE second reading (slightly different values)
    await readingsService.saveReading(IDs.business, {
      ...mockReading,
      main: { ...mockReading.main, voltage: 215.0, energy_kwh: 13.100 },
    });
    await new Promise(r => setTimeout(r, 500));

    const today2 = await readingsService.getTodayReadings(IDs.business);
    if (today2.length >= 2) {
      pass('Multiple readings saved', `${today2.length} readings total today`);
    } else {
      fail('Multiple readings', `expected 2+, got ${today2.length}`);
    }

    // BILL CALCULATION — ENEO tiered tariff
const tests = [
  { kwh: 0,   expected: 0,     label: '0 kWh' },
  { kwh: 50,  expected: 2500,  label: '50 kWh = 50×50 = 2,500 FCFA' },
  { kwh: 110, expected: 5500,  label: '110 kWh = 110×50 = 5,500 FCFA (tier 1 ceiling)' },
  { kwh: 200, expected: 12610, label: '200 kWh = 5,500 + (90×79) = 12,610 FCFA' },
  { kwh: 400, expected: 28410, label: '400 kWh = 5,500 + (290×79) = 28,410 FCFA (tier 2 ceiling)' },
  { kwh: 500, expected: 37810, label: '500 kWh = 28,410 + (100×94) = 37,810 FCFA (tier 3)' },
];
    let allCalcPass = true;
    for (const t of tests) {
      const result = readingsService.calculateCostFcfa(t.kwh);
      if (result !== t.expected) {
        fail(`calculateCostFcfa(${t.kwh})`, `expected ${t.expected}, got ${result}`);
        allCalcPass = false;
      }
    }
    if (allCalcPass) {
      pass('calculateCostFcfa — ENEO tariff', 'all 5 tier calculations correct');
    }

  } catch (err) {
    fail('readingsService', err.message);
  }
}

//  TEST 6 — ALERTS SERVICE
async function testAlertsService() {
  section('Alerts Service');
  try {
    // CREATE low voltage alert
    const alert1 = await alertsService.createAlert(
      IDs.business,
      alertsService.buildLowVoltageAlert(IDs.device, 178.4, 190)
    );
    pass('createAlert (low voltage)', `ID: ${alert1.alertId}`);

    // CREATE room shutdown alert
    const alert2 = await alertsService.createAlert(
      IDs.business,
      alertsService.buildRoomShutdownAlert(
        IDs.device, 'room_2', 'Meeting Room', 0.42, 33
      )
    );
    pass('createAlert (room shutdown)', `saved 33 FCFA`);

    // CREATE device offline alert
    const alert3 = await alertsService.createAlert(
      IDs.business,
      alertsService.buildDeviceOfflineAlert(IDs.device)
    );
    pass('createAlert (device offline)', `ID: ${alert3.alertId}`);

    // GET ACTIVE (all 3 should be unresolved)
    await new Promise(r => setTimeout(r, 500));
    const active = await alertsService.getActiveAlerts(IDs.business);
    if (active.length >= 3) {
      pass('getActiveAlerts', `${active.length} active alerts`);
    } else {
      fail('getActiveAlerts', `expected 3+, got ${active.length}`);
    }

    // Verify severity ordering
    const urgentAlerts = active.filter(a => a.severity === 'urgent');
    if (urgentAlerts.length >= 2) {
      pass('Alert severities set correctly', `${urgentAlerts.length} urgent alerts`);
    } else {
      fail('Alert severities', `expected 2 urgent, got ${urgentAlerts.length}`);
    }

    // RESOLVE alert
    await alertsService.resolveAlert(IDs.business, alert1.alertId);
    const afterResolve = await alertsService.getActiveAlerts(IDs.business);
    const resolvedStillActive = afterResolve.find(a => a.id === alert1.alertId);
    if (!resolvedStillActive) {
      pass('resolveAlert', 'resolved alert removed from active list');
    } else {
      fail('resolveAlert', 'alert still showing as active');
    }

    // MARK NOTIFIED
    await alertsService.markAlertNotified(
      IDs.business, alert2.alertId, ['dashboard', 'whatsapp']
    );
    const history = await alertsService.getAlertHistory(IDs.business);
    const notified = history.find(a => a.id === alert2.alertId);
    if (notified && notified.notified_via.includes('whatsapp')) {
      pass('markAlertNotified', `channels: ${notified.notified_via.join(', ')}`);
    } else {
      fail('markAlertNotified', 'notification channels not saved');
    }

  } catch (err) {
    fail('alertsService', err.message);
  }
}

//  TEST 7 — USER SERVICE
async function testUserService() {
  section('User Service');
  try {
    // CREATE owner user
    const created = await userService.createUser(IDs.user, {
      name:        'Jean-Baptiste Mbarga',
      email:       'jb.test.aems@gmail.com',
      phone:       '+237 691 234 567',
      password:    'SecurePass123!',
      role:        userService.ROLES.OWNER,
      business_id: IDs.business,
    });
    pass('createUser (owner)', `ID: ${created.userId}`);

    // Verify password is NOT stored in plain text
    const raw = await db.ref(`users/${IDs.user}`).once('value');
    const rawData = raw.val();
    if (rawData.password_hash && rawData.password_hash !== 'SecurePass123!') {
      pass('Password hashed', 'plain text password NOT stored');
    } else {
      fail('Password hashing', '⚠️  SECURITY ISSUE: plain text stored');
    }

    // GET BY ID (no password hash returned)
    const user = await userService.getUserById(IDs.user);
    if (user && !user.password_hash) {
      pass('getUserById', 'password_hash not exposed');
    } else {
      fail('getUserById', 'password_hash should not be in response');
    }

    // GET BY EMAIL
    const byEmail = await userService.getUserByEmail('jb.test.aems@gmail.com');
    if (byEmail && byEmail.name === 'Jean-Baptiste Mbarga') {
      pass('getUserByEmail', `found: ${byEmail.name}`);
    } else {
      fail('getUserByEmail', 'user not found by email');
    }

    // AUTHENTICATE — correct password
    const authOk = await userService.authenticateUser(
      'jb.test.aems@gmail.com', 'SecurePass123!'
    );
    if (authOk && authOk.role === 'owner') {
      pass('authenticateUser (correct password)', `role: ${authOk.role}`);
    } else {
      fail('authenticateUser', 'authentication failed with correct password');
    }

    // AUTHENTICATE — wrong password
    const authBad = await userService.authenticateUser(
      'jb.test.aems@gmail.com', 'WrongPassword!'
    );
    if (authBad === null) {
      pass('authenticateUser (wrong password)', 'correctly rejected');
    } else {
      fail('authenticateUser (wrong password)', 'should have returned null');
    }

    // VERIFY OWNER PERMISSIONS
    const owner = await userService.getUserById(IDs.user);
    if (
      owner.permissions.view_dashboard   === true &&
      owner.permissions.control_devices  === true &&
      owner.permissions.view_reports     === true &&
      owner.permissions.change_settings  === true &&
      owner.permissions.manage_users     === false
    ) {
      pass('Owner permissions', 'all permissions set correctly');
    } else {
      fail('Owner permissions', JSON.stringify(owner.permissions));
    }

    // CREATE staff user and verify limited permissions
    const staffId = `${IDs.user}_staff`;
    await userService.createUser(staffId, {
      name:        'Clarisse Fotso',
      email:       'clarisse.test.aems@gmail.com',
      password:    'StaffPass456!',
      role:        userService.ROLES.STAFF,
      business_id: IDs.business,
    });
    const staff = await userService.getUserById(staffId);
    if (
      staff.permissions.control_devices === true &&
      staff.permissions.view_reports    === false &&
      staff.permissions.change_settings === false
    ) {
      pass('Staff permissions', 'limited access correctly set');
    } else {
      fail('Staff permissions', JSON.stringify(staff.permissions));
    }

    // Clean up staff user
    await db.ref(`users/${staffId}`).remove();

  } catch (err) {
    fail('userService', err.message);
  }
}

//  CLEANUP — Remove all test data from Firebase
async function cleanup() {
  section('Cleanup — Removing test data from Firebase');
  try {
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    await db.ref(`businesses/${IDs.business}`).remove();
    await db.ref(`devices/${IDs.device}`).remove();
    await db.ref(`rooms/${IDs.business}`).remove();
    await db.ref(`readings/${IDs.business}`).remove();
    await db.ref(`alerts/${IDs.business}`).remove();
    await db.ref(`users/${IDs.user}`).remove();
    await db.ref(`monthly_reports/${IDs.business}`).remove();

    console.log('  ✅ All test data removed from Firebase');
    console.log('  ✅ Your Firebase database is clean');

  } catch (err) {
    console.log(`  ⚠️  Cleanup warning: ${err.message}`);
    console.log('  → Manually delete any test_ entries from Firebase Console');
  }
}

//  MAIN — Run all tests in sequence
async function runAllTests() {

  await testFirebaseConnection();
  await testBusinessService();
  await testDeviceService();
  await testRoomService();
  await testReadingsService();
  await testAlertsService();
  await testUserService();
  await cleanup();

  // ── Final results ─────────────────────────────────────────
  
  process.exit(failed > 0 ? 1 : 0);
}

// ── Run ─────────────────────────────────────────────────────
runAllTests().catch((err) => {
  console.error('\nFatal error:', err.message);
  console.error('Check your .env file and serviceAccountKey.json');
  process.exit(1);
});