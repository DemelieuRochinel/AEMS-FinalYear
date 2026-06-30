const db = require('../config/firebase');

const roomsRef = (businessId) => db.ref(`rooms/${businessId}`);

// ── CREATE — Add a new room to a business ──
const createRoom = async (businessId, roomId, data) => {
  try {
    const roomData = {
      business_id:    businessId,
      device_id:      data.device_id,
      name:           data.name,
      floor:          data.floor          || 1,
      relay_id:       data.relay_id,
      pir_gpio_pin:   data.pir_gpio_pin   || null,
      acs712_channel: data.acs712_channel || null,
      device_type:    data.device_type    || 'lights',
      // Live state fields — updated by automation engine
      occupied:       false,
      relay_status:   'OFF',
      status:         'OFF', // Normalization field added
      last_motion:    null,
      empty_since:    null,
      auto_shutdown:  data.auto_shutdown  ?? true,
      created_at:     new Date().toISOString(),
    };

    await roomsRef(businessId).child(roomId).set(roomData);

    return { success: true, roomId, data: roomData };

  } catch (error) {
    console.error('createRoom error:', error.message);
    throw new Error(`Failed to create room: ${error.message}`);
  }
};

const getRoomsByBusiness = async (businessId) => {
  try {
    const snapshot = await roomsRef(businessId).once('value');
    if (!snapshot.exists()) return [];

    const rooms = [];
    snapshot.forEach((child) => {
      rooms.push({ id: child.key, ...child.val() });
      
    });

    // console.log(rooms);

    return rooms;

  } catch (error) {
    console.error('getRoomsByBusiness error:', error.message);
    throw new Error(`Failed to get rooms: ${error.message}`);
  }
};

const getRoomById = async (businessId, roomId) => {
  try {
    const snapshot = await roomsRef(businessId).child(roomId).once('value');
    if (!snapshot.exists()) return null;
    return { id: roomId, ...snapshot.val() };

  } catch (error) {
    console.error('getRoomById error:', error.message);
    throw new Error(`Failed to get room: ${error.message}`);
  }
};

const getRoomByRelay = async (businessId, deviceId, relayId) => {
  try {
    const rooms = await getRoomsByBusiness(businessId);
    return rooms.find((room) => (
      room.device_id === deviceId && room.relay_id === relayId
    )) || null;
  } catch (error) {
    console.error('getRoomByRelay error:', error.message);
    throw new Error(`Failed to get room by relay: ${error.message}`);
  }
};

const updateRoomOccupancy = async (businessId, roomId, occupied) => {
  try {
    const now = new Date().toISOString();
    const update = { occupied };

    if (occupied) {
      update.last_motion = now;
      update.empty_since  = null;
    } else {
      update.empty_since = now;
    }

    await roomsRef(businessId).child(roomId).update(update);
    return { success: true, roomId, occupied };

  } catch (error) {
    console.error('updateRoomOccupancy error:', error.message);
    throw new Error(`Failed to update occupancy: ${error.message}`);
  }
};

const updateRelayStatus = async (businessId, roomId, status) => {
  try {
    await roomsRef(businessId).child(roomId).update({
      relay_status: status,
      status:       status, // Synchronize status naming property variations
      updated_at:   new Date().toISOString(),
    });

    return { success: true, roomId, relay_status: status };

  } catch (error) {
    console.error('updateRelayStatus error:', error.message);
    throw new Error(`Failed to update relay: ${error.message}`);
  }
};

// ── FIXED: Added missing payload state updater wrapper function ──
const updateRoomState = async (businessId, roomId, updates) => {
  try {
    await roomsRef(businessId).child(roomId).update({
      ...updates,
      updated_at: new Date().toISOString(),
    });
    return { success: true, roomId };
  } catch (error) {
    console.error('updateRoomState error:', error.message);
    throw new Error(`Failed to update full room state: ${error.message}`);
  }
};

const toggleAutoShutdown = async (businessId, roomId, enabled) => {
  try {
    await roomsRef(businessId).child(roomId).update({
      auto_shutdown: enabled,
    });

    return { success: true, roomId, auto_shutdown: enabled };

  } catch (error) {
    console.error('toggleAutoShutdown error:', error.message);
    throw new Error(`Failed to toggle auto-shutdown: ${error.message}`);
  }
};

const listenToRooms = (businessId, callback) => {
  roomsRef(businessId).on('value', (snapshot) => {
    if (!snapshot.exists()) return;

    const rooms = {};
    snapshot.forEach((child) => {
      rooms[child.key] = child.val();
    });

    callback(rooms);
  });
};

const stopListening = (businessId) => {
  roomsRef(businessId).off();
};

const deleteRoom = async (businessId, roomId) => {
  try {
    await roomsRef(businessId).child(roomId).remove();
    return { success: true, roomId };

  } catch (error) {
    console.error('deleteRoom error:', error.message);
    throw new Error(`Failed to delete room: ${error.message}`);
  }
};

module.exports = {
  createRoom,
  getRoomsByBusiness,
  getRoomById,
  getRoomByRelay,
  updateRoomOccupancy,
  updateRelayStatus,
  updateRoomState, // Exported fixed hook
  toggleAutoShutdown,
  listenToRooms,
  stopListening,
  deleteRoom,
};
