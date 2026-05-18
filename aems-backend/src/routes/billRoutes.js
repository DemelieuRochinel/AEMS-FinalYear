//  BILL ROUTES
//  GET /api/bill/estimate  — current month ENEO bill estimate
//  GET /api/bill/today     — today's cost in FCFA

const express         = require('express');
const router          = express.Router();
const readingsService = require('../services/readingsService');
const reportService   = require('../services/reportService');
const { authenticate } = require('../middleware/authentication');

router.use(authenticate);

// GET /api/bill/estimate
router.get('/estimate', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const now        = new Date();

    // Get latest reading for current kWh
    const latest   = await readingsService.getLatestReading(businessId);
    const totalKwh = latest ? latest.main.energy_kwh : 0;

    // Calculate bill using ENEO tiered tariff
    const costFcfa = readingsService.calculateCostFcfa(totalKwh);

    // Days remaining in month
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed   = now.getDate();
    const daysLeft     = daysInMonth - daysPassed;

    // Project full month consumption based on current rate
    const dailyRate    = daysPassed > 0 ? totalKwh / daysPassed : 0;
    const projectedKwh = Math.round(dailyRate * daysInMonth * 100) / 100;
    const projectedCost= readingsService.calculateCostFcfa(projectedKwh);

    return res.status(200).json({
      period:              `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
      current_kwh:         totalKwh,
      current_cost_fcfa:   costFcfa,
      days_passed:         daysPassed,
      days_remaining:      daysLeft,
      projected_kwh:       projectedKwh,
      projected_cost_fcfa: projectedCost,
      tariff: {
        tier1: '50 FCFA/kWh (0–110 kWh)',
        tier2: '79 FCFA/kWh (111–400 kWh)',
        tier3: '94 FCFA/kWh (400+ kWh)',
      },
    });

  } catch (error) {
    console.error('GET /bill/estimate:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//GET /api/bill/today
router.get('/today', async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const today      = await readingsService.getTodayReadings(businessId);

    const maxKwh   = today.length > 0
      ? Math.max(...today.map(r => r.main.energy_kwh))
      : 0;

    return res.status(200).json({
      date:            new Date().toISOString().split('T')[0],
      readings_count:  today.length,
      kwh_today:       maxKwh,
      cost_fcfa:       readingsService.calculateCostFcfa(maxKwh),
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;