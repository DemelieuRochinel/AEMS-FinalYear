//  ROOMS ROUTES
//  GET   /api/rooms              — all rooms with live status
//  GET   /api/rooms/:id          — single room details
//  PATCH /api/rooms/:id/relay    — turn relay ON or OFF
//  PATCH /api/rooms/:id/auto     — toggle auto-shutdown

const express      = require('express');
const router       = express.Router();
const roomService  = require('../services/roomService');
const mqttService  = require('../services/mqttService');
// FIXED: Adjusted import spelling to match your global 'auth.js' filename structure
const { authenticate, requireRole } = require('../middleware/authentication');

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
    const room = await roomService.getRoomById(
      req.user.businessId, req.params.id
    );

    if (!room) {
      return res.status(404).json({
        error:   'Room not found',
        roomId:  req.params.id,
      });
    }

    return res.status(200).json({ room });

  } catch (error) {
    console.error('GET /rooms/:id:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

//  PATCH /api/rooms/:id/relay — Toggle Manual Control Switches
router.patch(
  '/:id/relay',
  requireRole('owner', 'staff', 'technician'),
  async (req, res) => {
    try {
      const { action, device_id } = req.body;
      const roomId     = req.params.id;
      const businessId = req.user.businessId;

      if (!action || !['ON', 'OFF'].includes(action)) {
        return res.status(400).json({
          error:   'Invalid action',
          message: 'action must be ON or OFF',
        });
      }

      if (!device_id) {
        return res.status(400).json({
          error:   'Missing device_id',
          message: 'Provide the device_id that controls this room',
        });
      }

      const room = await roomService.getRoomById(businessId, roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      //  FIXED: Reformatted command payload properties to precisely match what your hardware expects
      const command = {
        action:      'SET_RELAY',
        relay_id:    room.relay_id,
        status:      action, 
        room_id:     roomId,
        business_id: businessId,
        sent_by:     req.user.email,
      };

      // Publish over MQTT
      const published = mqttService.publishCommand(device_id, command);

      // Update room state values inside Firebase immediately
      await roomService.updateRelayStatus(businessId, roomId, action);

      // Force state persistence normalization on alternate variables used by UI maps
      if (typeof roomService.updateRoomState === 'function') {
        await roomService.updateRoomState(businessId, roomId, { relay_status: action, status: action });
      }

      // Push real-time event updates to dashboard sockets
      const io = req.app.get('io');
      if (io) {
        io.emit('room_update', {
          roomId,
          businessId,
          relay_status: action,
          status:       action,
          updated_by:   req.user.email,
          timestamp:    new Date().toISOString(),
        });
      }

      console.log(`[MANUAL OVERRIDE] ${req.user.email} → ${roomId} set to: ${action}`);

      return res.status(200).json({
        message:      `Room ${action === 'ON' ? 'powered on' : 'powered off'} successfully`,
        roomId,
        relay_id:     room.relay_id,
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
router.patch(
  '/:id/auto',
  requireRole('owner', 'technician'),
  async (req, res) => {
    try {
      const { enabled }  = req.body;
      const roomId       = req.params.id;
      const businessId   = req.user.businessId;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          error:   'Invalid value',
          message: 'enabled must be true or false',
        });
      }

      await roomService.toggleAutoShutdown(businessId, roomId, enabled);

      return res.status(200).json({
        message:       `Auto-shutdown ${enabled ? 'enabled' : 'disabled'}`,
        roomId,
        auto_shutdown: enabled,
      });

    } catch (error) {
      console.error('PATCH /rooms/:id/auto:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/rooms/:id — Remove a room profile from the business network entirely
router.delete('/:id', requireRole('owner', 'technician'), async (req, res) => {
  try {
    const roomId = req.params.id;
    const businessId = req.user.businessId;

    // Verify room exists before hitting delete routines
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
});

module.exports = router;