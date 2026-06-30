//  AUTOMATION RULES ENGINE
//  The intelligence of Automated energy management system this will runs every 30 seconds
//  Evaluates rules and executes actions automatically
//
//  Rules evaluated:
//  1. Empty room shutdown (PIR + timeout)
//  2. After-hours shutdown (closing time)
//  3. Voltage protection (ZMPT101B thresholds)
//  4. Daily budget exceeded (kWh limit)
//  5. Device offline detection (no MQTT heartbeat)

const readingsService = require('./readingsService');
const roomService     = require('./roomService');
const alertsService   = require('./alertsService');
const deviceService   = require('./deviceService');
const businessService = require('./businessService');
const mqttService     = require('./mqttService');

// Engine configuration 
const ENGINE_CONFIG = {
  cycleIntervalMs:    10 * 1000,   // ⚡ Evaluates every 10 seconds for active testing
  defaultVoltageMin:  190,         // volts — ENEO danger threshold
  defaultVoltageMax:  245,         // volts — overvoltage threshold
  defaultShutdownMin: 3,           // minutes empty before auto-shutdown
};

// Track recent alerts to prevent spam
const recentAlerts = new Map();
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between same alerts

// Module state
let ioInstance       = null;
let engineInterval   = null;
let isRunning        = false;

// ── INITIALIZE ──
const initialize = (io) => {
  ioInstance = io;

  if (isRunning) {
    console.log('Automation engine already running');
    return;
  }

  console.log('Automation engine starting...');

  _runCycle();
  engineInterval = setInterval(_runCycle, ENGINE_CONFIG.cycleIntervalMs);
  engineInterval.unref();
  isRunning = true;

  console.log(`Automation engine running (cycle: every ${ENGINE_CONFIG.cycleIntervalMs/1000}s)`);
};

// ── ENGINE RUN CYCLE ──
const _runCycle = async () => {
  try {
    const businesses = await businessService.getAllBusinesses();

    if (!Array.isArray(businesses) || businesses.length === 0) {
      return;
    }

    for (const business of businesses) {
      if (!business || !business.id) continue;
      await _evaluateBusinessRules(business);
    }

  } catch (err) {
    console.error('Automation cycle error:', err instanceof Error ? err.message : err);
  }
};

// ── EVALUATE BUSINESS RULES ──
const _evaluateBusinessRules = async (business) => {
  const businessId = business.id;
  const settings   = business.settings || {};

  try {
    let latestReading = null;
    let rooms         = [];

    try {
      latestReading = await readingsService.getLatestReading(businessId);
    } catch (err) {
      console.error(`Could not get reading for ${businessId}:`, err.message);
    }

    try {
      rooms = await roomService.getRoomsByBusiness(businessId);
    } catch (err) {
      console.error(`Could not get rooms for ${businessId}:`, err.message);
    }

    if (!isRunning) return;

    if (rooms.length > 0) {
      await _ruleEmptyRoomShutdown(businessId, rooms, settings);
      await _ruleAfterHoursShutdown(businessId, rooms, settings);
    }

    if (latestReading && latestReading.main) {
      await _ruleVoltageProtection(businessId, latestReading, settings);
      await _ruleDailyBudget(businessId, latestReading, settings);
    }

  } catch (err) {
    console.error(`Rules evaluation error for ${businessId}:`, err.message);
  }
};

// ── RULE 1: EMPTY ROOM SHUTDOWN ──
const _ruleEmptyRoomShutdown = async (businessId, rooms, settings) => {
  const delayMinutes = settings.auto_shutdown_delay || ENGINE_CONFIG.defaultShutdownMin;
  const delayMs      = delayMinutes * 60 * 1000;
  const now          = Date.now();

  for (const room of rooms) {
    try {
      if (!room.auto_shutdown) continue;
      if (room.occupied) continue;
      if (room.relay_status === 'OFF') continue;

      // FIXED: Fallback to current time if empty_since is uninitialized
      let emptyTime = room.empty_since;
      if (!emptyTime) {
        emptyTime = new Date().toISOString();
        if (typeof roomService.updateRoomState === 'function') {
          await roomService.updateRoomState(businessId, room.id, { empty_since: emptyTime, occupied: false });
        }
      }

      const emptyDurationMs = now - new Date(emptyTime).getTime();
      if (emptyDurationMs < delayMs) continue;

      const emptyMinutes = Math.round(emptyDurationMs / 60000);
      console.log(`Rule 1: ${room.name} empty ${emptyMinutes}min → shutting down`);

      const device = room.device_id
        ? await deviceService.getDeviceById(room.device_id)
        : null;
      if (!device) continue;

      try {
        // FIXED: Matched action and status to what your ESP32 simulator expects
        mqttService.publishCommand(device.id, {
          action:      'SET_RELAY',
          relay_id:    room.relay_id,
          status:      'OFF',
          room_id:     room.id,
          business_id: businessId,
          reason:      'auto_shutdown',
        });
      } catch (mqttErr) {
        console.log(`MQTT offline — command saved to Firebase only`);
      }

      await roomService.updateRelayStatus(businessId, room.id, 'OFF');

      const hoursEmpty     = emptyDurationMs / 3600000;
      const estimatedWatts = 500; 
      const savedKwh       = Math.round(estimatedWatts * hoursEmpty / 1000 * 100) / 100;
      const savedFcfa      = readingsService.calculateCostFcfa(savedKwh);

      const alertKey = `${businessId}_shutdown_${room.id}`;
      if (_canCreateAlert(alertKey)) {
        await alertsService.createAlert(
          businessId,
          alertsService.buildRoomShutdownAlert(
            device.id, room.id, room.name, savedKwh, savedFcfa
          )
        );
        _markAlertCreated(alertKey);
      }

      _emitToDashboard('room_update', {
        businessId,
        roomId:       room.id,
        roomName:     room.name,
        relay_status: 'OFF',
        reason:       'auto_shutdown',
        empty_minutes: emptyMinutes,
        saved_fcfa:   savedFcfa,
        timestamp:    new Date().toISOString(),
      });

    } catch (err) {
      console.error(`Rule 1 error for room ${room.id}:`, err.message);
    }
  }
};

// ── RULE 2: AFTER HOURS SHUTDOWN ──
const _ruleAfterHoursShutdown = async (businessId, rooms, settings) => {
  const closingTime = settings.closing_time || '18:30';
  const now         = new Date();
  const dayOfWeek   = now.getDay(); 

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (!isWeekday) return;

  const [closeHour, closeMin] = closingTime.split(':').map(Number);
  const closingMinutes = closeHour * 60 + closeMin;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const isAfterHours = currentMinutes >= closingMinutes &&
                       currentMinutes <= closingMinutes + 30;

  if (!isAfterHours) return;

  const alertKey = `${businessId}_afterhours_${now.toDateString()}`;
  if (!_canCreateAlert(alertKey)) return;

  const roomsStillOn = rooms.filter(r =>
    r.auto_shutdown && r.relay_status === 'ON'
  );

  if (roomsStillOn.length === 0) return;

  console.log(`Rule 2: After hours (${closingTime}) — shutting down ${roomsStillOn.length} rooms`);

  for (const room of roomsStillOn) {
    const device = room.device_id
      ? await deviceService.getDeviceById(room.device_id)
      : null;
    if (!device) continue;

    // FIXED: Aligned payload structural parameter formatting
    mqttService.publishCommand(device.id, {
      action:      'SET_RELAY',
      relay_id:    room.relay_id,
      status:      'OFF',
      room_id:     room.id,
      business_id: businessId,
      reason:      'after_hours',
    });

    await roomService.updateRelayStatus(businessId, room.id, 'OFF');
  }

  await alertsService.createAlert(businessId, {
    type:      'after_hours_shutdown',
    severity:  'info',
    message:   `After-hours shutdown: ${roomsStillOn.length} rooms secured at ${closingTime}`,
    device_id: roomsStillOn[0]?.device_id || null,
  });

  _markAlertCreated(alertKey);

  _emitToDashboard('after_hours_shutdown', {
    businessId,
    rooms_shutdown: roomsStillOn.length,
    closing_time:   closingTime,
    timestamp:      new Date().toISOString(),
  });
};

// ── RULE 3: VOLTAGE PROTECTION ──
const _ruleVoltageProtection = async (businessId, reading, settings) => {
  const voltageMin = settings.voltage_min || ENGINE_CONFIG.defaultVoltageMin;
  const voltageMax = settings.voltage_max || ENGINE_CONFIG.defaultVoltageMax;
  const voltage    = reading.main?.voltage;

  if (!voltage) return;

  if (voltage < voltageMin) {
    const alertKey = `${businessId}_low_voltage`;
    if (!_canCreateAlert(alertKey)) return;

    console.warn(`Rule 3: LOW VOLTAGE ${voltage}V < ${voltageMin}V`);

    await alertsService.createAlert(
      businessId,
      alertsService.buildLowVoltageAlert(reading.device_id, voltage, voltageMin)
    );

    _markAlertCreated(alertKey);

    _emitToDashboard('alert_triggered', {
      type:       'low_voltage',
      severity:   'urgent',
      voltage,
      businessId,
      timestamp:  new Date().toISOString(),
    });
  }

  if (voltage > voltageMax) {
    const alertKey = `${businessId}_high_voltage`;
    if (!_canCreateAlert(alertKey)) return;

    console.warn(`Rule 3: HIGH VOLTAGE ${voltage}V > ${voltageMax}V`);

    await alertsService.createAlert(
      businessId,
      alertsService.buildHighVoltageAlert(reading.device_id, voltage, voltageMax)
    );

    _markAlertCreated(alertKey);

    _emitToDashboard('alert_triggered', {
      type:       'high_voltage',
      severity:   'urgent',
      voltage,
      businessId,
      timestamp:  new Date().toISOString(),
    });
  }
};

// ── RULE 4: DAILY ENERGY BUDGET ──
const _ruleDailyBudget = async (businessId, reading, settings) => {
  const limit  = settings.daily_kwh_limit || 50;
  const kwh    = reading.main?.energy_kwh || 0;

  if (kwh <= limit) return;

  const alertKey = `${businessId}_budget_${new Date().toDateString()}`;
  if (!_canCreateAlert(alertKey)) return;

  console.warn(`Rule 4: Budget exceeded ${kwh} kWh > ${limit} kWh`);

  await alertsService.createAlert(businessId, {
    type:      'daily_limit_exceeded',
    severity:  'warning',
    message:   `Daily energy budget exceeded: ${kwh} kWh used (limit: ${limit} kWh)`,
    device_id: reading.device_id,
    value:     kwh,
    threshold: limit,
  });

  _markAlertCreated(alertKey);

  _emitToDashboard('alert_triggered', {
    type:       'daily_limit_exceeded',
    severity:   'warning',
    kwh,
    limit,
    businessId,
    timestamp:  new Date().toISOString(),
  });
};

//  HELPERS — Alert cooldown system
//  Prevents the same alert from firing every 30 seconds

const _canCreateAlert = (key) => {
  const lastCreated = recentAlerts.get(key);
  if (!lastCreated) return true;
  return Date.now() - lastCreated > ALERT_COOLDOWN_MS;
};

const _markAlertCreated = (key) => {
  recentAlerts.set(key, Date.now());
};


//  HELPER — Push event to dashboard via WebSocket

const _emitToDashboard = (event, data) => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
};

//  PUBLIC — Stop the engine (for testing)

const stop = () => {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
  }
    isRunning      = false;
    console.log('Automation engine stopped');
};

const getStatus = () => ({
  isRunning,
  cycleIntervalMs:  ENGINE_CONFIG.cycleIntervalMs,
  recentAlertsCount: recentAlerts.size,
});

module.exports = { initialize, stop, getStatus };
