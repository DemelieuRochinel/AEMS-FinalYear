const db = require('../config/firebase');

const alertsRef = (businessId) => db.ref(`alerts/${businessId}`);

const ALERT_TYPES = {
  LOW_VOLTAGE:           'low_voltage',
  HIGH_VOLTAGE:          'high_voltage',
  EMPTY_ROOM_SHUTDOWN:   'empty_room_shutdown',
  DAILY_LIMIT_EXCEEDED:  'daily_limit_exceeded',
  DEVICE_OFFLINE:        'device_offline',
  POWER_RESTORED:        'power_restored',
  OVERCURRENT:           'overcurrent',
  MONTHLY_REPORT_READY:  'monthly_report_ready',
};

const SEVERITY = {
  URGENT:  'urgent',
  WARNING: 'warning',
  INFO:    'info',
};

const createAlert = async (businessId, data) => {
  try {
    const alertData = {
      type:          data.type,
      severity:      data.severity,
      message:       data.message,
      device_id:     data.device_id     || null,
      room_id:       data.room_id       || null,
      room_name:     data.room_name     || null,
      value:         data.value         || null,
      threshold:     data.threshold     || null,
      // Energy saved (for auto-shutdown alerts)
      energy_saved_kwh:  data.energy_saved_kwh  || null,
      cost_saved_fcfa:   data.cost_saved_fcfa   || null,
      timestamp:     new Date().toISOString(),
      resolved:      false,
      resolved_at:   null,
      notified_via:  [],
    };

    // Firebase push() generates a unique key automatically
    const ref  = await alertsRef(businessId).push(alertData);

    return { success: true, alertId: ref.key, data: alertData };
 
  } catch (error) {
    console.error('createAlert error:', error.message);
    throw new Error(`Failed to create alert: ${error.message}`);
  }
};

//  READ — Get all unresolved alerts (shown on dashboard)
const getActiveAlerts = async (businessId) => {
  try {
    const snapshot = await alertsRef(businessId)
      .orderByChild('resolved')
      .equalTo(false)
      .once('value');

    if (!snapshot.exists()) return [];

    const alerts = [];
    snapshot.forEach((child) => {
      alerts.push({ id: child.key, ...child.val() });
    });

    // Sort by timestamp descending (newest first)
    return alerts.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

  } catch (error) {e
    console.error('getActiveAlerts error:', error.message);
    throw new Error(`Failed to get active alerts: ${error.message}`);
  }
};


const getAlertHistory = async (businessId, limit = 50) => {
  try {
    const snapshot = await alertsRef(businessId)
      .limitToLast(limit)
      .once('value');

    if (!snapshot.exists()) return [];

    const alerts = [];
    snapshot.forEach((child) => {
      alerts.push({ id: child.key, ...child.val() });
    });

    return alerts.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

  } catch (error) {
    console.error('getAlertHistory error:', error.message);
    throw new Error(`Failed to get alert history: ${error.message}`);
  }
};


const resolveAlert = async (businessId, alertId) => {
  try {
    await alertsRef(businessId).child(alertId).update({
      resolved:    true,
      resolved_at: new Date().toISOString(),
    });

    return { success: true, alertId };

  } catch (error) {
    console.error('resolveAlert error:', error.message);
    throw new Error(`Failed to resolve alert: ${error.message}`);
  }
};

const markAlertNotified = async (businessId, alertId, channels) => {
  try {
    await alertsRef(businessId).child(alertId).update({
      notified_via: channels,
    });

    return { success: true, alertId, notified_via: channels };

  } catch (error) {
    console.error('markAlertNotified error:', error.message);
    throw new Error(`Failed to mark alert notified: ${error.message}`);
  }
};

const buildLowVoltageAlert = (deviceId, voltage, threshold) => ({
  type:      ALERT_TYPES.LOW_VOLTAGE,
  severity:  SEVERITY.URGENT,
  message:   `Voltage dropped to ${voltage}V — sensitive equipment at risk (threshold: ${threshold}V)`,
  device_id: deviceId,
  value:     voltage,
  threshold,
});

const buildHighVoltageAlert = (deviceId, voltage, threshold) => ({
  type:      ALERT_TYPES.HIGH_VOLTAGE,
  severity:  SEVERITY.URGENT,
  message:   `Dangerous voltage spike: ${voltage}V detected (threshold: ${threshold}V)`,
  device_id: deviceId,
  value:     voltage,
  threshold,
});

const buildRoomShutdownAlert = (deviceId, roomId, roomName, savedKwh, savedFcfa) => ({
  type:             ALERT_TYPES.EMPTY_ROOM_SHUTDOWN,
  severity:         SEVERITY.INFO,
  message:          `${roomName} auto-shutdown — room was empty. Saved ${savedFcfa} FCFA`,
  device_id:        deviceId,
  room_id:          roomId,
  room_name:        roomName,
  energy_saved_kwh: savedKwh,
  cost_saved_fcfa:  savedFcfa,
});

const buildDeviceOfflineAlert = (deviceId) => ({
  type:      ALERT_TYPES.DEVICE_OFFLINE,
  severity:  SEVERITY.URGENT,
  message:   `AEMS device ${deviceId} went offline — possible ENEO power cut`,
  device_id: deviceId,
});

module.exports = {
  ALERT_TYPES,
  SEVERITY,
  createAlert,
  getActiveAlerts,
  getAlertHistory,
  resolveAlert,
  markAlertNotified,
  buildLowVoltageAlert,
  buildHighVoltageAlert,
  buildRoomShutdownAlert,
  buildDeviceOfflineAlert,
};