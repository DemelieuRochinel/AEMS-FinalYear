const express = require('express');
const router = express.Router();
const businessService = require('../services/businessService');
const { authenticate } = require('../middleware/authentication');
const { randomUUID } = require('crypto');

router.post('/create', async (req, res) => {
  try {
    const {
      business_id,
      name,
      owner_name,
      owner_email,
      owner_phone,
      location,
      business_type,
    } = req.body;
    const businessId = business_id || `biz_${randomUUID()}`;

    if (!name || !owner_email) {
      return res.status(400).json({
        error: 'Missing required parameters. name and owner_email are required.',
      });
    }

    const result = await businessService.createBusiness(businessId, {
      name,
      owner_name,
      owner_email,
      owner_phone,
      location,
      business_type,
    });

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

router.get('/profile', async (req, res) => {
  try {
    const business = await businessService.getBusinessById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    return res.status(200).json({ business });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const allowed = ['name', 'owner_name', 'owner_phone', 'location'];
    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    await businessService.updateBusiness(req.user.businessId, updates);
    const updated = await businessService.getBusinessById(req.user.businessId);
    return res.status(200).json({ business: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    await businessService.updateBusinessSettings(req.user.businessId, req.body);
    return res.status(200).json({
      message: 'Settings updated',
      settings: req.body,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
