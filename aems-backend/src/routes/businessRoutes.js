const express         = require('express');
const router          = express.Router();
const businessService = require('../services/businessService');
const { authenticate } = require('../middleware/authentication');


// POST /api/business/create — Register a brand new business profile
router.post('/create', async (req, res) => {
  try {
    const { business_id, name, owner_name, owner_email, owner_phone, location, business_type } = req.body;

    // Validate incoming data
    if (!business_id || !name || !owner_email) {
      return res.status(400).json({ 
        error: 'Missing required parameters. business_id, name, and owner_email are required.' 
      });
    }

    // Call your business service module layer
    const result = await businessService.createBusiness(business_id, {
      name,
      owner_name,
      owner_email,
      owner_phone,
      location,
      business_type
    });

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ── PROTECTED ROUTES (Requires Login Authentication Token) ──
router.use(authenticate);

// GET /api/business/profile — get current user's business
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

// PATCH /api/business/profile — update business profile
router.patch('/profile', async (req, res) => {
  try {
    const allowed = ['name', 'owner_name', 'owner_phone', 'location'];
    const updates = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    await businessService.updateBusiness(req.user.businessId, updates);
    const updated = await businessService.getBusinessById(req.user.businessId);
    return res.status(200).json({ business: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/business/settings — update energy settings
router.patch('/settings', async (req, res) => {
  try {
    await businessService.updateBusinessSettings(req.user.businessId, req.body);
    return res.status(200).json({ message: 'Settings updated', settings: req.body });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/business/rooms — create a new room
router.post('/rooms', async (req, res) => {
  try {
    const { name, device_type, relay_id, pir_gpio_pin, auto_shutdown } = req.body;
    if (!name || !relay_id) {
      return res.status(400).json({ error: 'name and relay_id are required' });
    }
    const roomService = require('../services/roomService');
    const deviceService = require('../services/deviceService');

    // Get first device for this business
    const devices = await deviceService.getDevicesByBusiness(req.user.businessId);
    const deviceId = devices.length > 0 ? devices[0].id : 'device_BUEA001';

    const roomId = `room_${Date.now()}`;
    await roomService.createRoom(req.user.businessId, roomId, {
      device_id:     deviceId,
      name,
      relay_id,
      device_type:   device_type,
      auto_shutdown: auto_shutdown ?? true,
      pir_gpio_pin:  pir_gpio_pin || null,
    });

    return res.status(201).json({ message: 'Room created', roomId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
