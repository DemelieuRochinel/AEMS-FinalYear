//  Handles all communication between ESP32 hardware and backend
//  
//  TOPICS:
//  aems/{device_id}/readings  ← ESP32 sends sensor data
//  aems/{device_id}/status    ← ESP32 online/offline heartbeat
//  aems/{device_id}/alerts    ← ESP32 hardware-level alerts
//  aems/{device_id}/commands  → Backend sends relay commands

const mqtt = require('mqtt');
require('dotenv').config();

//Import services this module depends on 
const readingsService = require('./readingsService');
const deviceService   = require('./deviceService');
const alertsService   = require('./alertsService');
const roomService     = require('./roomService');

//MQTT topic definitions
const TOPICS = {
  ALL_READINGS: 'aems/+/readings',
  ALL_STATUS:   'aems/+/status',
  ALL_ALERTS:   'aems/+/alerts',
};

//Module state
let client         = null;  // MQTT client instance
let ioInstance     = null;  // Socket.io for pushing to dashboard
let isConnected    = false; //here i check if the device is connected.

// ── Device timeout tracker (detect offline devices)
// Stores: { deviceId: lastSeenTimestamp }
const deviceHeartbeats = {};
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

//  INITIALIZE — Start MQTT connection
//  Called once from server.js at startup
const initialize = (io) => {
 ioInstance = io;

  const brokerUrl = process.env.MQTT_BROKER_URL;

  console.log(`Connecting to MQTT broker: ${brokerUrl}`);

  client = mqtt.connect(brokerUrl, {
    clientId:             `aems-backend-${Date.now()}`, // each client will have the unique clientId
    clean:                true,
    connectTimeout:       10000, // time that will lock you out
    reconnectPeriod:      3000,  // retry every 3 seconds if disconnected
    username:             process.env.MQTT_USERNAME || undefined,
    password:             process.env.MQTT_PASSWORD || undefined,
  });

  // connection events 
  client.on('connect', _onConnect);
  client.on('message', _onMessage);
  client.on('error',   _onError);
  client.on('close',   _onClose);

  client.on('reconnect', () => {
    console.log('MQTT reconnecting...');
  });

  // Start offline device detector
  _startOfflineDetector();

  return client;
};

//  PRIVATE — Connection established
const _onConnect = () => {
  isConnected = true; //if the device is connect like i check before then let log some message
  console.log('MQTT broker connected');

  // Subscribe to all device topics using wildcards
  const subscriptions = Object.values(TOPICS);

  subscriptions.forEach((topic) => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err.message);
      } else {
        console.log(`Subscribed: ${topic}`);
      }
    });
  });
};

//  PRIVATE — Message received from ESP32
const _onMessage = async (topic, messageBuffer) => {
  const message = messageBuffer.toString();

  // Extract device_id from topic: "aems/device_BUEA001/readings"
  const topicParts = topic.split('/');
  const deviceId   = topicParts[1];
  const messageType = topicParts[2];

  // Update heartbeat for this device
  deviceHeartbeats[deviceId] = Date.now();

  let data;
  try {
    data = JSON.parse(message);
  } catch {
    console.error(`Invalid JSON from ${deviceId} on topic ${topic}`);
    return;
  }

  console.log(`[${messageType.toUpperCase()}] from ${deviceId}`);

  // Route message to correct handler based on topic type
  switch (messageType) {
    case 'readings': await _handleReading(deviceId, data);  break;
    case 'status':   await _handleStatus(deviceId, data);   break;
    case 'alerts':   await _handleHardwareAlert(deviceId, data); break;
    default:
      console.warn(`Unknown topic type: ${messageType}`);
  }
};

//  PRIVATE Handle sensor reading from ESP32
//  This is the most critical handler — called every 5 seconds
const _handleReading = async (deviceId, data) => {
  try {
    const businessId = data.business_id;

    if (!businessId) {
      console.error(`Reading from ${deviceId} missing business_id`);
      return;
    }

    // 1. Save reading to Firebase
    await readingsService.saveReading(businessId, data);

    // 2. Push live data to dashboard via WebSocket instantly
    if (ioInstance) {
      ioInstance.emit('sensor_data', {
        deviceId,
        businessId,
        timestamp: new Date().toISOString(),
        data,
      });
    }

    // 3. Check voltage thresholds — protect equipment
    await _checkVoltageAlerts(businessId, deviceId, data.main);

    // 4. Update room occupancy states (UPDATED with room names)
    await _updateRoomStates(businessId, deviceId, data.rooms);

    // 5. Mark device as online
    await deviceService.markDeviceOnline(deviceId);

  } catch (err) {
    console.error(`_handleReading error:`, err.message);
  }
};

//  PRIVATE — Handle device status message (heartbeat)
const _handleStatus = async (deviceId, data) => {
  try {
    if (data.status === 'online') {
      await deviceService.markDeviceOnline(deviceId);
      console.log(`Device ${deviceId} is ONLINE`);

      // Notify dashboard
      if (ioInstance) {
        ioInstance.emit('device_status', {
          deviceId,
          status:    'online',
          timestamp: new Date().toISOString(),
        });
      }
    } else if (data.status === 'offline') {
      await deviceService.markDeviceOffline(deviceId);
      console.log(`Device ${deviceId} is OFFLINE`);
    }
  } catch (err) {
    console.error(`_handleStatus error:`, err.message);
  }
};

//  PRIVATE — Handle hardware-level alert from ESP32
const _handleHardwareAlert = async (deviceId, data) => {
  try {
    console.log(`Hardware alert from ${deviceId}:`, data.type);

    await alertsService.createAlert(data.business_id, {
      type:      data.type,
      severity:  data.severity || 'urgent',
      message:   data.message,
      device_id: deviceId,
    });

  } catch (err) {
    console.error(` _handleHardwareAlert error:`, err.message);
  }
};

//  PRIVATE — Check voltage thresholds and create alerts
const _checkVoltageAlerts = async (businessId, deviceId, mainData) => {
  if (!mainData || !mainData.voltage) return;
//here we are checking the main voltage in the system at that time.
  const voltage   = mainData.voltage;
  const minV      = 190;
  const maxV      = 245;

  if (voltage < minV) {
    console.warn(`LOW VOLTAGE: ${voltage}V (min: ${minV}V)`);
    await alertsService.createAlert(
      businessId,
      alertsService.buildLowVoltageAlert(deviceId, voltage, minV)
    );

    // Notify dashboard immediately
    if (ioInstance) {
      ioInstance.emit('alert_triggered', {
        type:     'low_voltage',
        severity: 'urgent',
        voltage,
        businessId,
      });
    }
  }

  if (voltage > maxV) {
    console.warn(`HIGH VOLTAGE: ${voltage}V (max: ${maxV}V)`);
    await alertsService.createAlert(
      businessId,
      alertsService.buildHighVoltageAlert(deviceId, voltage, maxV)
    );

    if (ioInstance) {
      ioInstance.emit('alert_triggered', {
        type:     'high_voltage',
        severity: 'urgent',
        voltage,
        businessId,
      });
    }
  }
};

//  ── PRIVATE — Update room occupancy from PIR sensor data ──
//  ✅ UPDATED: Now saves room names and current readings
//  ── PRIVATE — Update room occupancy AND relay status from ESP32 data ──
const _updateRoomStates = async (businessId, deviceId, roomsData) => {
  if (!roomsData) return;

  for (const [roomId, roomData] of Object.entries(roomsData)) {
    try {
      // Prepare update data
      const updates = {
        last_seen: new Date().toISOString(),
      };
      
      // Update occupancy if provided
      if (typeof roomData.occupied === 'boolean') {
        updates.occupied = roomData.occupied;
        
        // If occupied, update last_motion; if empty, set empty_since
        if (roomData.occupied) {
          updates.last_motion = new Date().toISOString();
          updates.empty_since = null;
        } else {
          updates.empty_since = new Date().toISOString();
        }
      }
      
      // ── ✅ NEW: Set relay status based on occupancy ──
      // The ESP32 simulator sends relay status in the reading
      // If we have relay data from the reading, use it
      if (roomData.relay_status) {
        updates.relay_status = roomData.relay_status;
        updates.status = roomData.relay_status; // Keep both fields in sync
      } else if (typeof roomData.occupied === 'boolean') {
        // Fallback: set relay based on occupancy
        const relayStatus = roomData.occupied ? 'ON' : 'OFF';
        updates.relay_status = relayStatus;
        updates.status = relayStatus;
      }
      
      // Save room name if provided
      if (roomData.name) {
        updates.name = roomData.name;
      }
      
      // Save room current if provided
      if (roomData.current_a !== undefined) {
        updates.current_a = roomData.current_a;
      }
      
      // Update timestamp
      updates.updated_at = new Date().toISOString();

      // Apply updates to Firebase
      await roomService.updateRoomState(businessId, roomId, updates);
      
    } catch (err) {
      // Non-critical — log and continue
      console.error(`Room update failed for ${roomId}:`, err.message);
    }
  }
};

//  PRIVATE — Detect devices that stopped sending data
//  Runs every minute, marks devices offline after 5 min silence
const _startOfflineDetector = () => {
  setInterval(async () => {
    const now = Date.now();

    for (const [deviceId, lastSeen] of Object.entries(deviceHeartbeats)) {
      const silentMs = now - lastSeen;

      if (silentMs > OFFLINE_THRESHOLD_MS) {
        console.warn(`Device ${deviceId} silent for ${Math.round(silentMs/60000)} min — marking offline`);

        try {
          await deviceService.markDeviceOffline(deviceId);

          // We need business_id to create alert
          const device = await deviceService.getDeviceById(deviceId);
          if (device && device.business_id) {
            await alertsService.createAlert(
              device.business_id,
              alertsService.buildDeviceOfflineAlert(deviceId)
            );

            if (ioInstance) {
              ioInstance.emit('device_status', {
                deviceId,
                status:    'offline',
                timestamp: new Date().toISOString(),
              });
            }
          }

          // Remove from heartbeat tracker
          delete deviceHeartbeats[deviceId];

        } catch (err) {
          console.error(`Offline detection error for ${deviceId}:`, err.message);
        }
      }
    }
  }, 60 * 1000); // check every 60 seconds
};

//  PUBLIC — Publish relay command to ESP32
//  Called by dashboard when user taps ON/OFF
const publishCommand = (deviceId, command) => {
  if (!client || !isConnected) {
    console.error('Cannot publish — MQTT not connected');
    return false;
  }

  const topic   = `aems/${deviceId}/commands`;
  const payload = JSON.stringify({
    ...command,
    sent_at: new Date().toISOString(),
  });

  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`Failed to publish command to ${deviceId}:`, err.message);
    } else {
      console.log(`Command sent to ${deviceId}:`, command);
    }
  });

  return true;
};

//  PUBLIC — Getters for external use
const getClient      = ()  => client;
const getIsConnected = ()  => isConnected;
const getHeartbeats  = ()  => deviceHeartbeats;

// Error and close handlers 
const _onError = (err) => {
  if(process.exiting) return;
  console.error('MQTT error:', err.message);
  isConnected = false;
};

const _onClose = () => {
  if (process.exiting) return;
  console.log('MQTT connection closed');
  isConnected = false;
};

// Add a clean disconnect method for testing teardowns
const disconnect = () => {
  if (client) {
    client.end(true, () => {
      isConnected = false;
      console.log('MQTT Client disconnected cleanly.');
    });
  }
};

module.exports = {
  TOPICS,
  initialize,
  publishCommand,
  getClient,
  getIsConnected,
  getHeartbeats,
  disconnect
};