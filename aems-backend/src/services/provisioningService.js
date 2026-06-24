// ── Import the db directly (backward compatible) ──
const db = require('../config/firebase');

// Get the deviceSetup reference
const deviceSetup = db.ref('device_setup');

/**
 * Generate a unique 6-digit setup code
 */
const generateUniqueSetupCode = async () => {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;

    const snapshot = await deviceSetup
      .orderByChild('code')
      .equalTo(code)
      .once('value');

    if (!snapshot.exists()) {
      return code;
    }

  } while (attempts < maxAttempts);

  throw new Error('Failed to generate unique setup code');
};

/**
 * Create a setup code for a device
 */
const createSetupCode = async (deviceId, businessId, expiryMinutes = 15) => {
  try {
    // Check for existing active code
    const existingSnapshot = await deviceSetup
      .orderByChild('device_id')
      .equalTo(deviceId)
      .once('value');

    if (existingSnapshot.exists()) {
      let hasActive = false;
      existingSnapshot.forEach((child) => {
        const data = child.val();
        if (!data.used && Date.now() < data.expires_at) {
          hasActive = true;
        }
      });

      if (hasActive) {
        throw new Error('Device already has an active setup code');
      }
    }

    const code = await generateUniqueSetupCode();
    const now = Date.now();
    const expiresAt = now + (expiryMinutes * 60 * 1000);

    const setupData = {
      code: code,
      device_id: deviceId,
      business_id: businessId,
      created_at: now,
      expires_at: expiresAt,
      used: false,
      used_at: null,
      claimed_by_mac: null,
    };

    await deviceSetup.child(deviceId).set(setupData);

    return {
      success: true,
      setup_code: code,
      device_id: deviceId,
      business_id: businessId,
      expires_at: new Date(expiresAt).toISOString(),
      expires_in_minutes: expiryMinutes,
      message: 'Setup code generated successfully'
    };

  } catch (error) {
    console.error('createSetupCode error:', error.message);
    throw new Error(`Failed to create setup code: ${error.message}`);
  }
};

/**
 * Claim a device using a setup code
 */
const claimDevice = async (code, macAddress = null, firmwareVersion = null) => {
  try {
    const snapshot = await deviceSetup
      .orderByChild('code')
      .equalTo(code)
      .once('value');

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'INVALID_CODE',
        message: 'Invalid setup code'
      };
    }

    let setupData = null;
    let deviceId = null;
    snapshot.forEach((child) => {
      setupData = child.val();
      deviceId = child.key;
    });

    if (Date.now() > setupData.expires_at) {
      return {
        success: false,
        error: 'CODE_EXPIRED',
        message: 'Setup code has expired',
        device_id: deviceId
      };
    }

    if (setupData.used) {
      return {
        success: false,
        error: 'CODE_USED',
        message: 'Setup code has already been used',
        device_id: deviceId
      };
    }

    const deviceSnapshot = await db.ref(`devices/${deviceId}`).once('value');
    if (!deviceSnapshot.exists()) {
      return {
        success: false,
        error: 'DEVICE_NOT_FOUND',
        message: 'Device no longer exists'
      };
    }

    // Mark as used
    await deviceSetup.child(deviceId).update({
      used: true,
      used_at: Date.now(),
      claimed_by_mac: macAddress
    });

    // Update device
    await db.ref(`devices/${deviceId}`).update({
      mac_address: macAddress || null,
      firmware_version: firmwareVersion || '1.0.0',
      is_online: true,
      last_seen: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      provisioning_completed: true
    });

    // Get business settings
    const businessSnapshot = await db.ref(`businesses/${setupData.business_id}/settings`).once('value');
    const businessSettings = businessSnapshot.exists() ? businessSnapshot.val() : {};

    return {
      success: true,
      device_id: deviceId,
      business_id: setupData.business_id,
      message: 'Device claimed successfully!',
      configuration: {
        device_id: deviceId,
        business_id: setupData.business_id,
        settings: businessSettings,
      }
    };

  } catch (error) {
    console.error('claimDevice error:', error.message);
    return {
      success: false,
      error: 'CLAIM_FAILED',
      message: `Failed to claim device: ${error.message}`
    };
  }
};

/**
 * Get device configuration
 */
const getDeviceConfiguration = async (deviceId) => {
  try {
    const deviceSnapshot = await db.ref(`devices/${deviceId}`).once('value');
    if (!deviceSnapshot.exists()) {
      return {
        success: false,
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      };
    }

    const device = deviceSnapshot.val();
    const businessId = device.business_id;

    const businessSnapshot = await db.ref(`businesses/${businessId}/settings`).once('value');
    const businessSettings = businessSnapshot.exists() ? businessSnapshot.val() : {};

    return {
      success: true,
      device_id: deviceId,
      business_id: businessId,
      configuration: {
        device_id: deviceId,
        business_id: businessId,
        settings: businessSettings,
        hardware: device.hardware || {},
        device_name: device.device_name || '',
        firmware_version: device.firmware_version || '1.0.0'
      }
    };

  } catch (error) {
    console.error('getDeviceConfiguration error:', error.message);
    return {
      success: false,
      error: 'CONFIG_FETCH_FAILED',
      message: `Failed to get device configuration: ${error.message}`
    };
  }
};

/**
 * Cleanup expired codes
 */
const cleanupExpiredCodes = async () => {
  try {
    const snapshot = await deviceSetup.once('value');
    if (!snapshot.exists()) return { success: true, deleted: 0 };

    let deleted = 0;
    const now = Date.now();
    const updates = {};

    snapshot.forEach((child) => {
      const data = child.val();
      if (data.expires_at < now && (!data.used || (data.used && (now - data.used_at) > 24 * 60 * 60 * 1000))) {
        updates[child.key] = null;
        deleted++;
      }
    });

    if (deleted > 0) {
      await deviceSetup.update(updates);
    }

    return { success: true, deleted };

  } catch (error) {
    console.error('cleanupExpiredCodes error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createSetupCode,
  claimDevice,
  getDeviceConfiguration,
  cleanupExpiredCodes
};