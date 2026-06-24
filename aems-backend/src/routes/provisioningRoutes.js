const express = require('express');
const router = express.Router();
const provisioningService = require('../services/provisioningService');
const { authenticate } = require('../middleware/authentication');
const deviceService = require('../services/deviceService');
const db = require('../config/firebase');

// =============================================
// 1. GENERATE SETUP CODE (Protected)
// POST /api/provision/generate-setup-code
// =============================================
router.post('/generate-setup-code', authenticate, async (req, res) => {
  try {
    const { device_id } = req.body;
    const businessId = req.user.businessId;

    if (!device_id) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'device_id is required'
      });
    }

    // Verify device exists and belongs to this business
    const device = await deviceService.getDeviceById(device_id);
    if (!device) {
      return res.status(404).json({
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });
    }

    if (device.business_id !== businessId) {
      return res.status(403).json({
        error: 'UNAUTHORIZED',
        message: 'Device does not belong to your business'
      });
    }

    // Check if device is already claimed
    if (device.provisioning_completed) {
      return res.status(400).json({
        error: 'ALREADY_PROVISIONED',
        message: 'This device has already been provisioned and claimed'
      });
    }

    // Generate setup code
    const result = await provisioningService.createSetupCode(
      device_id,
      businessId,
      15 // 15 minutes expiry
    );

    return res.status(201).json(result);

  } catch (error) {
    console.error('Generate setup code error:', error.message);
    return res.status(500).json({
      error: 'GENERATION_FAILED',
      message: error.message
    });
  }
});

// =============================================
// 2. CLAIM DEVICE (ESP32 uses this - No Auth)
// POST /api/provision/claim-device
// =============================================
router.post('/claim-device', async (req, res) => {
  try {
    const { setup_code, mac_address, firmware_version } = req.body;

    if (!setup_code) {
      return res.status(400).json({
        error: 'MISSING_SETUP_CODE',
        message: 'setup_code is required'
      });
    }

    // Validate setup code format (6 digits)
    if (!/^\d{6}$/.test(setup_code)) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Setup code must be exactly 6 digits'
      });
    }

    // Claim the device
    const result = await provisioningService.claimDevice(
      setup_code,
      mac_address || null,
      firmware_version || null
    );

    if (!result.success) {
      // Map error types to appropriate HTTP status codes
      const statusMap = {
        'INVALID_CODE': 404,
        'CODE_EXPIRED': 400,
        'CODE_USED': 400,
        'DEVICE_NOT_FOUND': 404,
        'CLAIM_FAILED': 500
      };

      const statusCode = statusMap[result.error] || 400;
      return res.status(statusCode).json({
        error: result.error,
        message: result.message,
        device_id: result.device_id || null
      });
    }

    // Success - return configuration to ESP32
    return res.status(200).json({
      success: true,
      device_id: result.device_id,
      business_id: result.business_id,
      message: result.message,
      configuration: result.configuration
    });

  } catch (error) {
    console.error('Claim device error:', error.message);
    return res.status(500).json({
      error: 'CLAIM_FAILED',
      message: `Internal server error: ${error.message}`
    });
  }
});

// =============================================
// 3. GET DEVICE CONFIGURATION
// GET /api/provision/device-config/:deviceId
// =============================================
router.get('/device-config/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'Device ID is required'
      });
    }

    const result = await provisioningService.getDeviceConfiguration(deviceId);

    if (!result.success) {
      const statusCode = result.error === 'DEVICE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        error: result.error,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      device_id: result.device_id,
      business_id: result.business_id,
      configuration: result.configuration
    });

  } catch (error) {
    console.error('Get device config error:', error.message);
    return res.status(500).json({
      error: 'CONFIG_FETCH_FAILED',
      message: error.message
    });
  }
});

// =============================================
// 4. REFRESH CONFIGURATION
// POST /api/provision/refresh-config
// =============================================
router.post('/refresh-config', async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({
        error: 'MISSING_DEVICE_ID',
        message: 'device_id is required'
      });
    }

    const result = await provisioningService.getDeviceConfiguration(device_id);

    if (!result.success) {
      return res.status(404).json({
        error: result.error,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      configuration: result.configuration,
      message: 'Configuration refreshed successfully'
    });

  } catch (error) {
    console.error('Refresh config error:', error.message);
    return res.status(500).json({
      error: 'REFRESH_FAILED',
      message: error.message
    });
  }
});

// =============================================
// 5. VALIDATE SETUP CODE (For UI feedback)
// POST /api/provision/validate-code
// =============================================
router.post('/validate-code', async (req, res) => {
  try {
    const { setup_code } = req.body;

    if (!setup_code || !/^\d{6}$/.test(setup_code)) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Setup code must be exactly 6 digits'
      });
    }

    // Find the setup code
    const snapshot = await db.ref('device_setup')
      .orderByChild('code')
      .equalTo(setup_code)
      .once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({
        valid: false,
        error: 'INVALID_CODE',
        message: 'Invalid setup code'
      });
    }

    let setupData = null;
    snapshot.forEach((child) => {
      setupData = child.val();
    });

    // Check expiry
    if (Date.now() > setupData.expires_at) {
      return res.status(400).json({
        valid: false,
        error: 'CODE_EXPIRED',
        message: 'Setup code has expired'
      });
    }

    if (setupData.used) {
      return res.status(400).json({
        valid: false,
        error: 'CODE_USED',
        message: 'Setup code has already been used'
      });
    }

    return res.status(200).json({
      valid: true,
      device_id: setupData.device_id,
      business_id: setupData.business_id,
      message: 'Setup code is valid and ready to use'
    });

  } catch (error) {
    console.error('Validate code error:', error.message);
    return res.status(500).json({
      error: 'VALIDATION_FAILED',
      message: error.message
    });
  }
});

module.exports = router;