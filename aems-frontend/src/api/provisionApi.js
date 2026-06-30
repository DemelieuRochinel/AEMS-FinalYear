import api from './axiosConfig';

/**
 * Provisioning API - For device setup and configuration
 */
export const provisionApi = {
  /**
   * Generate a setup code for a device
   * @param {string} deviceId - The device ID to generate code for
   * @returns {Promise} - { setup_code, device_id, business_id, expires_at }
   */
  generateSetupCode: async (deviceId) => {
    const response = await api.post('/api/provision/generate-setup-code', {
      device_id: deviceId
    });
    return response.data;
  },

  /**
   * Get device configuration by ID
   * @param {string} deviceId - The device ID
   * @returns {Promise} - Device configuration with settings
   */
  getDeviceConfig: async (deviceId) => {
    const response = await api.get(`/api/provision/device-config/${deviceId}`);
    return response.data;
  },

  /**
   * Validate a setup code without claiming it
   * @param {string} setupCode - The 6-digit setup code
   * @returns {Promise} - { valid, device_id, business_id }
   */
  validateCode: async (setupCode) => {
    const response = await api.post('/api/provision/validate-code', {
      setup_code: setupCode
    });
    return response.data;
  },

  /**
   * Claim a device with a setup code
   * @param {{setup_code: string, mac_address?: string, firmware_version?: string}} payload
   * @returns {Promise} - Claimed device configuration
   */
  claimDevice: async (payload) => {
    const response = await api.post('/api/provision/claim-device', payload);
    return response.data;
  },

  claimSimulatedDevice: async (setupCode) => {
    const response = await api.post('/api/provision/claim-simulated-device', {
      setup_code: setupCode
    });
    return response.data;
  },

  /**
   * Refresh device configuration
   * @param {string} deviceId - The device ID
   * @returns {Promise} - Updated configuration
   */
  refreshConfig: async (deviceId) => {
    const response = await api.post('/api/provision/refresh-config', {
      device_id: deviceId
    });
    return response.data;
  },

  getProvisionStatus: async (deviceId) => {
    const response = await api.get(`/api/provision/status/${deviceId}`);
    return response.data;
  },

  resetDevice: async (deviceId) => {
    const response = await api.post(`/api/provision/reset-device/${deviceId}`);
    return response.data;
  },
};
