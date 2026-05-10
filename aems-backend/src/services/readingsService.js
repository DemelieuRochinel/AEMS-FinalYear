const db = require('../config/firebase');

const getDatePath = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

const getTimeKey = (date = new Date()) => {
  return date.toISOString().replace(/[:.]/g, '-');
};

const readingsRef = (businessId, datePath = '') =>
  db.ref(`readings/${businessId}${datePath ? '/' + datePath : ''}`);

const saveReading = async (businessId, data) => {
  try {
    const now      = new Date();
    const datePath = getDatePath(now);
    const timeKey  = getTimeKey(now);

    const reading = {
      timestamp: now.toISOString(),
      device_id: data.device_id,

      main: {
        voltage:      parseFloat(data.main?.voltage)      || 0,
        current:      parseFloat(data.main?.current)      || 0,
        power:        parseFloat(data.main?.power)        || 0,
        energy_kwh:   parseFloat(data.main?.energy_kwh)   || 0,
        frequency:    parseFloat(data.main?.frequency)    || 0,
        power_factor: parseFloat(data.main?.power_factor) || 0,
      },

      rooms: data.rooms || {},

      relays: data.relays || {},
    };

    await readingsRef(businessId, datePath)
      .child(timeKey)
      .set(reading);

    return { success: true, path: `readings/${businessId}/${datePath}/${timeKey}` };

  } catch (error) {
    console.error('saveReading error:', error.message);
    throw new Error(`Failed to save reading: ${error.message}`);
  }
};

const getLatestReading = async (businessId) => {
  try {
    const datePath = getDatePath();
    const snapshot = await readingsRef(businessId, datePath)
      .limitToLast(1)
      .once('value');

    if (!snapshot.exists()) return null;

    let latest = null;
    snapshot.forEach((child) => {
      latest = { id: child.key, ...child.val() };
    });

    return latest;

  } catch (error) {
    console.error('getLatestReading error:', error.message);
    throw new Error(`Failed to get latest reading: ${error.message}`);
  }
};

const getTodayReadings = async (businessId) => {
  try {
    const datePath = getDatePath();
    const snapshot = await readingsRef(businessId, datePath).once('value');

    if (!snapshot.exists()) return [];

    const readings = [];
    snapshot.forEach((child) => {
      readings.push({ id: child.key, ...child.val() });
    });

    return readings;

  } catch (error) {
    console.error('getTodayReadings error:', error.message);
    throw new Error(`Failed to get today readings: ${error.message}`);
  }
};

const getReadingsByDate = async (businessId, year, month, day) => {
  try {
    const datePath = `${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
    const snapshot = await readingsRef(businessId, datePath).once('value');

    if (!snapshot.exists()) return [];

    const readings = [];
    snapshot.forEach((child) => {
      readings.push({ id: child.key, ...child.val() });
    });

    return readings;

  } catch (error) {
    console.error('getReadingsByDate error:', error.message);
    throw new Error(`Failed to get readings by date: ${error.message}`);
  }
};


const getDailySummary = async (businessId, year, month, day) => {
  try {
    const readings = await getReadingsByDate(businessId, year, month, day);

    if (readings.length === 0) {
      return {
        date:          `${year}-${month}-${day}`,
        total_readings: 0,
        max_power_w:   0,
        avg_voltage:   0,
        max_kwh:       0,
        cost_fcfa:     0,
      };
    }

    // Calculate summary statistics
    const voltages  = readings.map(r => r.main.voltage).filter(v => v > 0);
    const powers    = readings.map(r => r.main.power);
    const maxKwh    = Math.max(...readings.map(r => r.main.energy_kwh));
    const avgV      = voltages.reduce((a, b) => a + b, 0) / voltages.length;

    return {
      date:           `${year}-${month}-${day}`,
      total_readings: readings.length,
      max_power_w:    Math.max(...powers),
      avg_voltage:    Math.round(avgV * 10) / 10,
      max_kwh:        maxKwh,
      cost_fcfa:      calculateCostFcfa(maxKwh),
    };

  } catch (error) {
    console.error('❌ getDailySummary error:', error.message);
    throw new Error(`Failed to get daily summary: ${error.message}`);
  }
};

// ───────────────────────────────────────────────────────────
//  CALCULATE — ENEO bill in FCFA using tiered tariff
//  Tier 1: 0–110 kWh   = 50 FCFA/kWh
//  Tier 2: 111–400 kWh = 79 FCFA/kWh
//  Tier 3: 400+ kWh    = 94 FCFA/kWh
// ───────────────────────────────────────────────────────────
const calculateCostFcfa = (kwh) => {
  if (kwh <= 0)   return 0;
  if (kwh <= 110) return Math.round(kwh * 50);

  const tier1 = 110 * 50;

  if (kwh <= 400) return Math.round(tier1 + (kwh - 110) * 79);

  const tier2 = 290 * 79;
  return Math.round(tier1 + tier2 + (kwh - 400) * 94);
};

// ───────────────────────────────────────────────────────────
//  LISTEN — Real-time listener for latest reading
//  Used by WebSocket to push live data to dashboard
// ───────────────────────────────────────────────────────────
const listenToLatestReading = (businessId, callback) => {
  const datePath = getDatePath();

  readingsRef(businessId, datePath)
    .limitToLast(1)
    .on('child_added', (snapshot) => {
      callback({ id: snapshot.key, ...snapshot.val() });
    });
};

const stopListeningToReadings = (businessId) => {
  const datePath = getDatePath();
  readingsRef(businessId, datePath).off();
};

module.exports = {
  saveReading,
  getLatestReading,
  getTodayReadings,
  getReadingsByDate,
  getDailySummary,
  calculateCostFcfa,
  listenToLatestReading,
  stopListeningToReadings,
};