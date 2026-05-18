//  ROOMS ROUTES
//  GET   /api/rooms              — all rooms with live status
//  GET   /api/rooms/:id          — single room details
//  PATCH /api/rooms/:id/relay    — turn relay ON or OFF
//  PATCH /api/rooms/:id/auto     — toggle auto-shutdown

const express      = require('express');
const router       = express.Router();
const roomService  = require('../services/roomService');
const mqttService  = require('../services/mqttService');
const { authenticate, requireRole } = require('../middleware/authentication');

router.use(authenticate);

//  GET /api/rooms
//  Returns all rooms with live occupancy and relay status
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
//  Returns a single room with full details
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

//  PATCH /api/rooms/:id/relay
//  Turn a room's devices ON or OFF
//  Body: { action: 'ON' | 'OFF', device_id: 'device_BUEA001' }
//  Requires: owner or staff role
router.patch(
  '/:id/relay',
  requireRole('owner', 'staff', 'technician'),
  async (req, res) => {
    try {
      const { action, device_id } = req.body;
      const roomId     = req.params.id;
      const businessId = req.user.businessId;

      // Validate input
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

      // Get room to find relay_id 
      const room = await roomService.getRoomById(businessId, roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Publish command to ESP32 via MQTT 
      const command = {
        relay_id:    room.relay_id,
        action,
        room_id:     roomId,
        business_id: businessId,
        sent_by:     req.user.email,
      };

      const published = mqttService.publishCommand(device_id, command);

      if (!published) {
        return res.status(503).json({
          error:   'Device unreachable',
          message: 'MQTT broker not connected — command not sent',
        });
      }

      // Update room relay status in Firebase immediately
      await roomService.updateRelayStatus(businessId, roomId, action);

      //Push update to dashboard via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.emit('room_update', {
          roomId,
          businessId,
          relay_status: action,
          updated_by:   req.user.email,
          timestamp:    new Date().toISOString(),
        });
      }

      console.log(`${req.user.email} → ${roomId} relay: ${action}`);

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
//  Toggle auto-shutdown for a room
//  Body: { enabled: true | false }
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

module.exports = router;