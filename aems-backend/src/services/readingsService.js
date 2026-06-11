const db = require('../config/firebase');
const { checkout } = require('../routes/authenticationRouts');



// Safe limitToLast — Firebase requires positive integer
const safeLimitToLast = (ref, count) => {
  const safe = Math.max(1, Math.abs(Math.floor(Number(count) || 1)));
  return ref.limitToLast(safe);
};

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

// FIXED: Moved calculation function to the top to prevent hoisting/lexical execution issues
const calculateCostFcfa = (kwh) => {
  if (kwh <= 0)   return 0;
  if (kwh <= 110) return Math.round(kwh * 50);

  const tier1 = 110 * 50;
  if (kwh <= 400) return Math.round(tier1 + (kwh - 110) * 79);

  const tier2 = 290 * 79;
  return Math.round(tier1 + tier2 + (kwh - 400) * 94);
};

const saveReading = async (businessId, data) => {
  try {
    const now      = new Date();
    const datePath = getDatePath(now);
    const timeKey  = getTimeKey(now);

    // Filter transient telemetry dropouts before writing to the DB
    const inputVoltage = parseFloat(data.main?.voltage);
    const validatedVoltage = (isNaN(inputVoltage) || inputVoltage < 40) ? null : inputVoltage;

    const reading = {
      timestamp: now.toISOString(),
      device_id: data.device_id,

      main: {
        // Fallback to null or standard grid assumptions if values are corrupted
        voltage:      validatedVoltage || 220, 
        current:      parseFloat(data.main?.current)      || 0,
        power:        parseFloat(data.main?.power)        || 0,
        energy_kwh:   parseFloat(data.main?.energy_kwh)   || 0,
        frequency:    parseFloat(data.main?.frequency)    || 50.0,
        power_factor: parseFloat(data.main?.power_factor) || 1.0,
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
    let snapshot = await readingsRef(businessId, datePath)
      .limitToLast(1)
      .once('value');

    // FIXED fallback: If today's directory has no metrics yet (new user or early morning),
    // query the base root to pull the last available entry across historical logs.
    if (!snapshot.exists()) {
      snapshot = await readingsRef(businessId)
        .orderByChild('timestamp')
        .limitToLast(1)
        .once('value');
    }

    if (!snapshot.exists()) return null;

    let latest = null;
    snapshot.forEach((child) => {
      // Handle shallow vs deep path parsing differences nested inside query variants
      const val = child.val();
      if (val.main) {
        latest = { id: child.key, ...val };
      } else {
        // If it's structured multi-level deeply, crawl into its tree properties
        child.forEach((yearChild) => {
          yearChild.forEach((monthChild) => {
            monthChild.forEach((dayChild) => {
              latest = { id: dayChild.key, ...dayChild.val() };
            });
          });
        });
      }
    });

    return latest;

  } catch (error) {
    console.error('getLatestReading error:', error.message);
    return null;
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
    return [];
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
    return [];
  }
};

const getDailySummary = async (businessId, year, month, day) => {
  try {
    const readings = await getReadingsByDate(businessId, year, month, day);

    if (readings.length === 0) {
      return {
        date:          `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        total_readings: 0,
        max_power_w:   0,
        avg_voltage:   0,
        max_kwh:       0,
        cost_fcfa:     0,
      };
    }

    const voltages  = readings.map(r => r.main?.voltage).filter(v => v > 0);
    const powers    = readings.map(r => r.main?.power).filter(p => p >= 0);
    const maxKwh    = Math.max(...readings.map(r => r.main?.energy_kwh || 0));
    const avgV      = voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : 0;

    return {
      date:           `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      total_readings: readings.length,
      max_power_w:    powers.length > 0 ? Math.max(...powers) : 0,
      avg_voltage:    Math.round(avgV * 10) / 10,
      max_kwh:        maxKwh,
      cost_fcfa:      calculateCostFcfa(maxKwh),
    };

  } catch (error) {
    console.error('getDailySummary error:', error.message);
    return {
      date: `${year}-${month}-${day}`,
      total_readings: 0,
      max_power_w:    0,
      avg_voltage:    0,
      max_kwh:        0,
      cost_fcfa:      0,
    };
  }
};

const listenToLatestReading = (businessId, callback) => {
  try {
    const datePath = getDatePath();
    const ref = readingsRef(businessId, datePath);

    ref.limitToLast(1).once('value', (snapshot) => {
      if (!snapshot.exists()) return;
      snapshot.forEach((child) => {
        callback({ id: child.key, ...child.val() });
      });
    });

  } catch (error) {
    console.error('listenToLatestReading error:', error.message);
  }
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
