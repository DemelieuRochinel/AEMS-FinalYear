
const db = require('../config/firebase');

const devicesRef = db.ref('devices');

const createDevice = async (deviceId, data) => {
  try {
    const deviceData = {
      business_id:      data.business_id,   // so khere is the PK of the business here which is the FK of the device
      device_name:      data.device_name,
      location:         data.location         || 'Main Distribution Board',
      firmware_version: data.firmware_version || '1.0.0',
      is_online:        false,
      last_seen:        null,
      installed_at:     new Date().toISOString(),
      installed_by:     data.installed_by     || 'admin',

      hardware: {
        has_pzem:      data.hardware?.has_pzem      ?? true,
        pzem_address:  data.hardware?.pzem_address  || 1,
        num_relays:    data.hardware?.num_relays     || 8,
        num_pir:       data.hardware?.num_pir        || 4,
        num_acs712:    data.hardware?.num_acs712     || 4,
        has_sd_card:   data.hardware?.has_sd_card    ?? true,
      },
    };

    await devicesRef.child(deviceId).set(deviceData);

    return { success: true, deviceId, data: deviceData };

  } catch (error) {
    console.error('createDevice error:', error.message);
    throw new Error(`Failed to create device: ${error.message}`);
  }
};

const getDeviceById = async (deviceId) => {
  try {
    const snapshot = await devicesRef.child(deviceId).once('value');
    if (!snapshot.exists()) return null;
    return { id: deviceId, ...snapshot.val() };

  } catch (error) {
    console.error('getDeviceById error:', error.message);
    throw new Error(`Failed to get device: ${error.message}`);
  }
};


const getDevicesByBusiness = async (businessId) => {
  try {
    const snapshot = await devicesRef
      .orderByChild('business_id')
      .equalTo(businessId)
      .once('value');

    if (!snapshot.exists()) return [];

    const devices = [];
    snapshot.forEach((child) => {
      devices.push({ id: child.key, ...child.val() });
    });

    return devices;

  } catch (error) {
    console.error('getDevicesByBusiness error:', error.message);
    throw new Error(`Failed to get devices: ${error.message}`);
  }
};


const markDeviceOnline = async (deviceId) => {
  try {
    await devicesRef.child(deviceId).update({
      is_online: true,
      last_seen: new Date().toISOString(),
    });

    return { success: true, deviceId, is_online: true };

  } catch (error) {
    console.error('markDeviceOnline error:', error.message);
    throw new Error(`Failed to mark device online: ${error.message}`);
  }
};

const markDeviceOffline = async (deviceId) => {
  try {
    await devicesRef.child(deviceId).update({
      is_online: false,
      last_seen: new Date().toISOString(),
    });

    return { success: true, deviceId, is_online: false };

  } catch (error) {
    console.error('markDeviceOffline error:', error.message);
    throw new Error(`Failed to mark device offline: ${error.message}`);
  }
};

// ───────────────────────────────────────────────────────────
//  UPDATE — Update firmware version after OTA update
// ───────────────────────────────────────────────────────────
const updateFirmwareVersion = async (deviceId, version) => {
  try {
    await devicesRef.child(deviceId).update({
      firmware_version: version,
      updated_at: new Date().toISOString(),
    });

    return { success: true, deviceId, firmware_version: version };

  } catch (error) {
    console.error('updateFirmwareVersion error:', error.message);
    throw new Error(`Failed to update firmware version: ${error.message}`);
  }
};


const deleteDevice = async (deviceId) => {
  try {
    await devicesRef.child(deviceId).remove();
    return { success: true, deviceId };

  } catch (error) {
    console.error('deleteDevice error:', error.message);
    throw new Error(`Failed to delete device: ${error.message}`);
  }
};

module.exports = {
  createDevice,
  getDeviceById,
  getDevicesByBusiness,
  markDeviceOnline,
  markDeviceOffline,
  updateFirmwareVersion,
  deleteDevice,
};