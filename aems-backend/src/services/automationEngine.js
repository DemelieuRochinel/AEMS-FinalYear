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
  cycleIntervalMs:    30 * 1000,   // evaluate rules every 30 seconds
  defaultVoltageMin:  190,         // volts — ENEO danger threshold
  defaultVoltageMax:  245,         // volts — overvoltage threshold
  defaultShutdownMin: 15,          // minutes empty before auto-shutdown

};

// Track recent alerts to prevent spam
// Key: `${businessId}_${alertType}_${roomId}` Value: timestamp

const recentAlerts = new Map();
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between same alerts

//  Module state
let ioInstance       = null;
let engineInterval   = null;
let isRunning        = false;

//  INITIALIZE — Start the automation engine
//  Called from server.js after MQTT is connected

const initialize = (io) => {
  ioInstance = io;

  if (isRunning) {
    console.log('Automation engine already running');
    return;
  }

  console.log('Automation engine starting...');

  // Run first cycle immediately then repeat
  _runCycle();
  engineInterval = setInterval(_runCycle, ENGINE_CONFIG.cycleIntervalMs);
  engineInterval.unref();
  isRunning = true;

  console.log(`Automation engine running (cycle: every ${ENGINE_CONFIG.cycleIntervalMs/1000}s)`);
};

//  PRIVATE — Main evaluation cycle

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
    // Log full error details to find root cause
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('Automation cycle error:', msg);
  }
};

// const _evaluateBusinessRules = async (business) => {
//   const businessId = business.id;
//   const settings   = business.settings || {};

//   try {
//     let latestReading = null;
//     let rooms         = [];

//     try {
//       latestReading = await readingsService.getLatestReading(businessId);
//     } catch (err) {
//       console.error(`getLatestReading failed for ${businessId}:`,
//         err instanceof Error ? err.message : String(err)
//       );
//     }

//     try {
//       rooms = await roomService.getRoomsByBusiness(businessId);
//     } catch (err) {
//       console.error(`getRoomsByBusiness failed for ${businessId}:`,
//         err instanceof Error ? err.message : String(err)
//       );
//     }

//     if (Array.isArray(rooms) && rooms.length > 0) {
//       await _ruleEmptyRoomShutdown(businessId, rooms, settings);
//       await _ruleAfterHoursShutdown(businessId, rooms, settings);
//     }

//     if (latestReading && latestReading.main) {
//       await _ruleVoltageProtection(businessId, latestReading, settings);
//       await _ruleDailyBudget(businessId, latestReading, settings);
//     }

//   } catch (err) {
//     const msg = err instanceof Error ? err.message : JSON.stringify(err);
//     console.error(`Rules evaluation error for ${businessId}:`, msg);
//   }
// };



//  PRIVATE — Evaluate all rules for one business
const _evaluateBusinessRules = async (business) => {
  const businessId = business.id;
  const settings   = business.settings || {};

  try {
    // Run both queries — if one fails, use empty default
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

    if(!isRunning) return;

    // Only run room rules if we have rooms
    if (rooms.length > 0) {
      await _ruleEmptyRoomShutdown(businessId, rooms, settings);
      await _ruleAfterHoursShutdown(businessId, rooms, settings);
    }

    // Only run reading rules if we have a valid reading
    if (latestReading && latestReading.main) {
      await _ruleVoltageProtection(businessId, latestReading, settings);
      await _ruleDailyBudget(businessId, latestReading, settings);
    }

  } catch (err) {
    console.error(`Rules evaluation error for ${businessId}:`, err.message);
    // Never crash the engine — log and continue
  }
};



//  RULE 1 — Empty Room Shutdown
//  IF room has been empty longer than shutdown delay
//  AND auto_shutdown is enabled for that room
//  AND relay is currently ON
//  THEN send OFF command to ESP32

const _ruleEmptyRoomShutdown = async (businessId, rooms, settings) => {
  const delayMinutes = settings.auto_shutdown_delay || ENGINE_CONFIG.defaultShutdownMin;
  const delayMs      = delayMinutes * 60 * 1000;
  const now          = Date.now();

  for (const room of rooms) {
    try {
      // Skip rooms with auto_shutdown disabled (e.g. server room)
      if (!room.auto_shutdown)      continue;

      // Skip rooms that are occupied
      if (room.occupied)            continue;

      // Skip rooms already powered off
      if (room.relay_status === 'OFF') continue;

      // Check if room has been empty long enough
      if (!room.empty_since)        continue;

      const emptyDurationMs = now - new Date(room.empty_since).getTime();

      if (emptyDurationMs < delayMs) continue;

      const emptyMinutes = Math.round(emptyDurationMs / 60000);

      console.log(`Rule 1: ${room.name} empty ${emptyMinutes}min → shutting down`);

      // Get device that controls this room
      const devices = await deviceService.getDevicesByBusiness(businessId);
      if (devices.length === 0) continue;

      const device = devices[0]; // primary device

      // Send OFF command to ESP32 via MQTT
      try {
  mqttService.publishCommand(device.id, {
    relay_id:    room.relay_id,
    action:      'OFF',
    room_id:     room.id,
    business_id: businessId,
    reason:      'auto_shutdown',
  });
} catch (mqttErr) {
  // MQTT failure does not stop automation — relay state still saved to Firebase
  console.log(`MQTT offline — command saved to Firebase only`);
}
      // Update relay status in Firebase
      await roomService.updateRelayStatus(businessId, room.id, 'OFF');

      // Calculate energy saved
      const hoursEmpty     = emptyDurationMs / 3600000;
      const estimatedWatts = 500; // average room consumption
      const savedKwh       = Math.round(estimatedWatts * hoursEmpty / 1000 * 100) / 100;
      const savedFcfa      = readingsService.calculateCostFcfa(savedKwh);

      // Create alert (with cooldown check)
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

      // Push live update to dashboard
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
      console.error(` Rule 1 error for room ${room.id}:`, err.message);
    }
  }
};

//  RULE 2 — After-Hours Shutdown
//  IF current time is past closing time
//  AND it is a weekday (Mon–Fri)
//  THEN shut down all non-essential circuits

const _ruleAfterHoursShutdown = async (businessId, rooms, settings) => {
  const closingTime = settings.closing_time || '18:30';
  const now         = new Date();
  const dayOfWeek   = now.getDay(); // 0=Sun, 6=Sat

  // Only apply on weekdays
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (!isWeekday) return;

  // Parse closing time
  const [closeHour, closeMin] = closingTime.split(':').map(Number);
  const closingMinutes = closeHour * 60 + closeMin;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Only run once — between closing time and closing time + 30 minutes
  const isAfterHours = currentMinutes >= closingMinutes &&
                       currentMinutes <= closingMinutes + 30;

  if (!isAfterHours) return;

  // Check if we already ran this rule today
  const alertKey = `${businessId}_afterhours_${now.toDateString()}`;
  if (!_canCreateAlert(alertKey)) return;

  const roomsStillOn = rooms.filter(r =>
    r.auto_shutdown && r.relay_status === 'ON'
  );

  if (roomsStillOn.length === 0) return;

  console.log(`Rule 2: After hours (${closingTime}) — shutting down ${roomsStillOn.length} rooms`);

  const devices = await deviceService.getDevicesByBusiness(businessId);
  if (devices.length === 0) return;

  const device = devices[0];

  for (const room of roomsStillOn) {
    mqttService.publishCommand(device.id, {
      relay_id:    room.relay_id,
      action:      'OFF',
      room_id:     room.id,
      business_id: businessId,
      reason:      'after_hours',
    });

    await roomService.updateRelayStatus(businessId, room.id, 'OFF');
  }

  // Create single after-hours alert
  await alertsService.createAlert(businessId, {
    type:      'after_hours_shutdown',
    severity:  'info',
    message:   `After-hours shutdown: ${roomsStillOn.length} rooms secured at ${closingTime}`,
    device_id: device.id,
  });

  _markAlertCreated(alertKey);

  _emitToDashboard('after_hours_shutdown', {
    businessId,
    rooms_shutdown: roomsStillOn.length,
    closing_time:   closingTime,
    timestamp:      new Date().toISOString(),
  });
};

//  RULE 3 — Voltage Protection
//  IF voltage is below min OR above max
//  THEN create urgent alert (MQTT handler already cuts power)

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

    console.warn(` Rule 3: HIGH VOLTAGE ${voltage}V > ${voltageMax}V`);

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

//  RULE 4 — Daily Budget Exceeded
//  IF today's kWh > business daily_kwh_limit
//  THEN send warning alert

const _ruleDailyBudget = async (businessId, reading, settings) => {
  const limit  = settings.daily_kwh_limit || 50;
  const kwh    = reading.main?.energy_kwh || 0;

  if (kwh <= limit) return;

  const alertKey = `${businessId}_budget_${new Date().toDateString()}`;
  if (!_canCreateAlert(alertKey)) return;

  console.warn(` Rule 4: Budget exceeded ${kwh} kWh > ${limit} kWh`);

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
