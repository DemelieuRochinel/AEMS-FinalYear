// ── Import the db directly (backward compatible) ──
const db = require('../config/firebase');

// Get the deviceSetup reference
const deviceSetup = db.ref('device_setup');

const getMqttConfigForDevice = () => {
  const host = process.env.MQTT_BROKER_HOST
    || (process.env.MQTT_BROKER_URL || '').replace(/^mqtts?:\/\//, '').split(':')[0]
    || 'localhost';
  const port = Number(process.env.MQTT_BROKER_PORT || 1883);
  return { mqtt_broker: host, mqtt_port: port };
};

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
    const mqttConfig = getMqttConfigForDevice();

    return {
      success: true,
      device_id: deviceId,
      business_id: setupData.business_id,
      message: 'Device claimed successfully!',
      mqtt_broker: mqttConfig.mqtt_broker,
      mqtt_port: mqttConfig.mqtt_port,
      configuration: {
        device_id: deviceId,
        business_id: setupData.business_id,
        settings: businessSettings,
        mqtt_broker: mqttConfig.mqtt_broker,
        mqtt_port: mqttConfig.mqtt_port,
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
    const mqttConfig = getMqttConfigForDevice();

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
        firmware_version: device.firmware_version || '1.0.0',
        mqtt_broker: mqttConfig.mqtt_broker,
        mqtt_port: mqttConfig.mqtt_port,
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

/**
 * Get provisioning status for a device (dashboard polling)
 */
const getDeviceProvisionStatus = async (deviceId) => {
  try {
    const deviceSnapshot = await db.ref(`devices/${deviceId}`).once('value');
    if (!deviceSnapshot.exists()) {
      return {
        success: false,
        error: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      };
    }

    const device = deviceSnapshot.val();
    return {
      success: true,
      device_id: deviceId,
      provisioning_completed: !!device.provisioning_completed,
      is_online: !!device.is_online,
      last_seen: device.last_seen || null,
      mac_address: device.mac_address || null,
      firmware_version: device.firmware_version || null,
      device_name: device.device_name || '',
    };
  } catch (error) {
    console.error('getDeviceProvisionStatus error:', error.message);
    return {
      success: false,
      error: 'STATUS_FETCH_FAILED',
      message: error.message,
    };
  }
};

/**
 * Reset device provisioning so it can be re-paired
 */
const resetDeviceProvisioning = async (deviceId, businessId) => {
  try {
    const deviceSnapshot = await db.ref(`devices/${deviceId}`).once('value');
    if (!deviceSnapshot.exists()) {
      return { success: false, error: 'DEVICE_NOT_FOUND', message: 'Device not found' };
    }

    const device = deviceSnapshot.val();
    if (device.business_id !== businessId) {
      return { success: false, error: 'UNAUTHORIZED', message: 'Device does not belong to your business' };
    }

    await db.ref(`devices/${deviceId}`).update({
      provisioning_completed: false,
      mac_address: null,
      is_online: false,
      last_seen: null,
      claimed_at: null,
      reset_at: new Date().toISOString(),
    });

    await deviceSetup.child(deviceId).remove();

    const codeResult = await createSetupCode(deviceId, businessId, 15);
    return {
      success: true,
      device_id: deviceId,
      setup_code: codeResult.setup_code,
      expires_at: codeResult.expires_at,
      message: 'Device reset. Use the new setup code on the ESP32 portal.',
    };
  } catch (error) {
    console.error('resetDeviceProvisioning error:', error.message);
    return {
      success: false,
      error: 'RESET_FAILED',
      message: error.message,
    };
  }
};

module.exports = {
  createSetupCode,
  claimDevice,
  getDeviceConfiguration,
  getDeviceProvisionStatus,
  resetDeviceProvisioning,
  cleanupExpiredCodes,
};
