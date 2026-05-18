//  GET /api/readings/live       — latest reading right now
//  GET /api/readings/today      — all readings from today
//  GET /api/readings/summary    — daily summary for charts
//  GET /api/readings/:y/:m/:d   — readings for specific date

const express         = require('express');
const router          = express.Router();
const readingsService = require('../services/readingsService');
const { authenticate } = require('../middleware/authentication');

// All reading routes require authentication
router.use(authenticate);

//  GET /api/readings/live
//  Returns the most recent sensor reading
//  Used by dashboard to show current voltage, power, kWh

router.get('/live', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const reading    = await readingsService.getLatestReading(businessId);

    if (!reading) {
      return res.status(404).json({
        error:   'No readings yet',
        message: 'No sensor data received from device yet',
      });
    }

    // Calculate current bill estimate
    const costFcfa = readingsService.calculateCostFcfa(reading.main.energy_kwh);

    return res.status(200).json({
      reading,
      bill_estimate_fcfa: costFcfa,
      timestamp:          new Date().toISOString(),
    });

  } catch (error) {
    console.error('GET /readings/live:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  GET /api/readings/today
//  Returns all readings from today
//  Used by dashboard line chart (live consumption graph)

router.get('/today', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const readings   = await readingsService.getTodayReadings(businessId);

    // Build chart-friendly format: array of {time, voltage, power, kwh}
    const chartData = readings.map(r => ({
      time:        r.timestamp,
      voltage:     r.main.voltage,
      current:     r.main.current,
      power:       r.main.power,
      energy_kwh:  r.main.energy_kwh,
      power_factor:r.main.power_factor,
    }));

    // Get max kWh of the day for bill calculation
    const maxKwh = readings.length > 0
      ? Math.max(...readings.map(r => r.main.energy_kwh))
      : 0;

    return res.status(200).json({
      count:              readings.length,
      chart_data:         chartData,
      max_kwh_today:      maxKwh,
      cost_today_fcfa:    readingsService.calculateCostFcfa(maxKwh),
    });

  } catch (error) {
    console.error('GET /readings/today:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  GET /api/readings/summary?days=7
//  Returns daily summaries for the last N days
//  Used by analytics bar chart

router.get('/summary', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const days       = parseInt(req.query.days) || 7;
    const summaries  = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const summary = await readingsService.getDailySummary(
        businessId,
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      summaries.push(summary);
    }

    return res.status(200).json({
      days,
      summaries,
      total_kwh:       summaries.reduce((sum, s) => sum + s.max_kwh, 0),
      total_cost_fcfa: summaries.reduce((sum, s) => sum + s.cost_fcfa, 0),
    });

  } catch (error) {
    console.error('GET /readings/summary:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  GET /api/readings/:year/:month/:day
//  Returns all readings for a specific date

router.get('/:year/:month/:day', async (req, res) => {
  try {
    const businessId   = req.user.businessId;
    const { year, month, day } = req.params;

    const readings = await readingsService.getReadingsByDate(
      businessId, year, month, day
    );

    return res.status(200).json({
      date:    `${year}-${month}-${day}`,
      count:   readings.length,
      readings,
    });

  } catch (error) {
    console.error('GET /readings/:date:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;