//  ROOMS ROUTES
//  GET   /api/rooms              — all rooms with live status
//  GET   /api/rooms/:id          — single room details
//  PATCH /api/rooms/:id/relay    — turn relay ON or OFF
//  PATCH /api/rooms/:id/auto     — toggle auto-shutdown
//  POST  /api/rooms              — create a new room
//  DELETE /api/rooms/:id         — remove a room

const express      = require('express');
const router       = express.Router();
const roomService  = require('../services/roomService');
const mqttService  = require('../services/mqttService');
const { authenticate, requireRole } = require('../middleware/authentication');
const { randomUUID } = require('crypto');

//  GET /api/rooms/device/:deviceId — used by ESP32/simulator (no user auth)
router.get('/device/:deviceId', async (req, res) => {
  try {
    const deviceService = require('../services/deviceService');
    const device = await deviceService.getDeviceById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const rooms = await roomService.getRoomsByBusiness(device.business_id);
    const deviceRooms = rooms.filter(room => room.device_id === device.id);

    return res.status(200).json({
      count: deviceRooms.length,
      rooms: deviceRooms,
    });
  } catch (error) {
    console.error('GET /rooms/device/:deviceId:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.use(authenticate);

//  GET /api/rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await roomService.getRoomsByBusiness(req.user.businessId);
    return res.status(200).json({
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    console.error('GET /rooms:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const room = await roomService.getRoomById(req.user.businessId, req.params.id);
    if (!room) {
      return res.status(404).json({
        error: 'Room not found',
        roomId: req.params.id,
      });
    }
    return res.status(200).json({ room });
  } catch (error) {
    console.error('GET /rooms/:id:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  PATCH /api/rooms/:id/relay — Toggle Manual Control Switches
router.patch('/:id/relay',
  requireRole('owner', 'staff', 'technician', 'BusinessOwner'),
  async (req, res) => {
    try {
      const { action, device_id } = req.body;
      const roomId = req.params.id;
      const businessId = req.user.businessId;

      if (!action || !['ON', 'OFF'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'action must be ON or OFF',
        });
      }

      if (!device_id) {
        return res.status(400).json({
          error: 'Missing device_id',
          message: 'Provide the device_id that controls this room',
        });
      }

      const room = await roomService.getRoomById(businessId, roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const command = {
        action: 'SET_RELAY',
        relay_id: room.relay_id,
        status: action,
        room_id: roomId,
        business_id: businessId,
        sent_by: req.user.email,
      };

      mqttService.publishCommand(device_id, command);
      await roomService.updateRelayStatus(businessId, roomId, action);

      if (typeof roomService.updateRoomState === 'function') {
        await roomService.updateRoomState(businessId, roomId, { relay_status: action, status: action });
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('room_update', {
          roomId,
          businessId,
          relay_status: action,
          status: action,
          updated_by: req.user.email,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`[MANUAL OVERRIDE] ${req.user.email} → ${roomId} set to: ${action}`);

      return res.status(200).json({
        message: `Room ${action === 'ON' ? 'powered on' : 'powered off'} successfully`,
        roomId,
        relay_id: room.relay_id,
        relay_status: action,
        command_sent: true,
      });

    } catch (error) {
      console.error('PATCH /rooms/:id/relay:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

//  PATCH /api/rooms/:id/auto
router.patch('/:id/auto',
  requireRole('owner', 'technician', 'BusinessOwner'),
  async (req, res) => {
    try {
      const { enabled } = req.body;
      const roomId = req.params.id;
      const businessId = req.user.businessId;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid value',
          message: 'enabled must be true or false',
        });
      }

      await roomService.toggleAutoShutdown(businessId, roomId, enabled);

      return res.status(200).json({
        message: `Auto-shutdown ${enabled ? 'enabled' : 'disabled'}`,
        roomId,
        auto_shutdown: enabled,
      });

    } catch (error) {
      console.error('PATCH /rooms/:id/auto:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

//  POST /api/rooms — Create a new room
router.post('/',
  requireRole('owner', 'staff', 'technician', 'BusinessOwner'),  // ✅ Added role check
  async (req, res) => {
    try {
      const { name, device_type, relay_id, pir_gpio_pin, auto_shutdown, device_id, floor } = req.body;
      
      if (!name || !relay_id) {
        return res.status(400).json({ error: 'name and relay_id are required' });
      }

      const deviceService = require('../services/deviceService');
      const devices = await deviceService.getDevicesByBusiness(req.user.businessId);
      const deviceId = device_id || (devices.length > 0 ? devices[0].id : null);

      if (!deviceId) {
        return res.status(400).json({
          error: 'No device found',
          message: 'Create a device before adding rooms.',
        });
      }

      const selectedDevice = devices.find((device) => device.id === deviceId);
      if (!selectedDevice) {
        return res.status(400).json({
          error: 'Invalid device',
          message: 'Select a device that belongs to your business.',
        });
      }

      const roomId = `room_${randomUUID()}`;
      await roomService.createRoom(req.user.businessId, roomId, {
        device_id: deviceId,
        name,
        relay_id,
        device_type: device_type || 'lights',
        auto_shutdown: auto_shutdown ?? true,
        pir_gpio_pin: pir_gpio_pin || null,
        floor: floor || selectedDevice.location || 'Main floor',
      });

      return res.status(201).json({ 
        success: true,
        message: 'Room created successfully', 
        roomId,
        room: {
          id: roomId,
          name,
          relay_id,
          device_type,
          auto_shutdown,
          device_id: deviceId,
          floor: floor || selectedDevice.location || 'Main floor'
        }
      });
    } catch (err) {
      console.error('POST /rooms error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
);

//  DELETE /api/rooms/:id — Remove a room
router.delete('/:id',
  requireRole('owner', 'technician', 'staff', 'BusinessOwner'),
  async (req, res) => {
    try {
      const roomId = req.params.id;
      const businessId = req.user.businessId;

      const room = await roomService.getRoomById(businessId, roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room could not be found' });
      }

      await roomService.deleteRoom(businessId, roomId);
      console.log(`[NETWORK CLASSIFICATION] ${req.user.email} deleted space registry: ${roomId}`);

      return res.status(200).json({
        success: true,
        message: 'Room deleted from AEMS configurations successfully',
        roomId
      });
    } catch (error) {
      console.error('DELETE /rooms/:id:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
