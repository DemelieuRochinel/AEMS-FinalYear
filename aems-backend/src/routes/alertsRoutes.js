//  ALERTS ROUTES
//  GET   /api/alerts          — all active alerts
//  GET   /api/alerts/history  — full alert history
//  PATCH /api/alerts/:id/resolve — mark alert resolved

const express        = require('express');
const router         = express.Router();
const alertsService  = require('../services/alertsService');
const { authenticate } = require('../middleware/authentication');

router.use(authenticate);

//GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await alertsService.getActiveAlerts(req.user.businessId);
    return res.status(200).json({ count: alerts.length, alerts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/alerts/history
router.get('/history', async (req, res) => {
  try {
    const limit   = parseInt(req.query.limit) || 50;
    const alerts  = await alertsService.getAlertHistory(
      req.user.businessId, limit
    );
    return res.status(200).json({ count: alerts.length, alerts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

//PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', async (req, res) => {
  try {
    await alertsService.resolveAlert(req.user.businessId, req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('alert_resolved', {
        alertId:    req.params.id,
        businessId: req.user.businessId,
        resolvedBy: req.user.email,
        timestamp:  new Date().toISOString(),
      });
    }

    return res.status(200).json({
      message: 'Alert resolved',
      alertId: req.params.id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;