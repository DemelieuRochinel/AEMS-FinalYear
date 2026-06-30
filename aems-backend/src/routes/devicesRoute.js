const express = require('express');
const router  = express.Router();
const { randomUUID } = require('crypto');

const deviceService = require('../services/deviceService');
const {authenticate} = require('../middleware/authentication');

router.get('/list', authenticate, async (req, res) => {
    try {
        const devices = await deviceService.getDevicesByBusiness(req.user.businessId);
        return res.status(200).json({
            count: devices.length,
            devices
        });
    } catch (err) {
        console.error("Device list error:", err);
        return res.status(500).json({error: err.message});
    }
});

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

const buildHardwarePayload = (hardware = {}) => ({
    has_pzem: hardware.has_pzem ?? true,
    pzem_address: toPositiveInt(hardware.pzem_address, 1) || 1,
    num_relays: toPositiveInt(hardware.num_relays, 4),
    num_pir: toPositiveInt(hardware.num_pir, 1),
    num_acs712: toPositiveInt(hardware.num_acs712, 0),
    has_sd_card: hardware.has_sd_card ?? false,
});

const createDeviceHandler = async (req, res) => {
    try{
        const {deviceId,businessId,name,location,hardware} = req.body;
        const resolvedBusinessId = req.user.businessId;
        const resolvedDeviceId = deviceId || `dev_${randomUUID()}`;

        if(!name){
           return res.status(400).json({ error: 'Missing device information!' });
        }

        if (businessId && businessId !== resolvedBusinessId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Cannot create a device for another business.'
            });
        }

            const result = await deviceService.createDevice(resolvedDeviceId,{
                business_id: resolvedBusinessId,
                device_name: name,
                location: location || null,
                hardware: buildHardwarePayload(hardware),
                installed_by: req.user.email
            });
            return res.status(201).json(result);

        }catch(err){
            console.error("Backend Error:", err);
            return res.status(500).json({error: err.message});

        }
};

router.post('/NewDevice', authenticate, createDeviceHandler);
router.post('/new-device', authenticate, createDeviceHandler);

router.patch('/:id/configuration', authenticate, async (req, res) => {
    try {
        const device = await deviceService.getDeviceById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (device.business_id !== req.user.businessId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Cannot configure a device for another business.'
            });
        }

        const { name, location, hardware } = req.body;
        const updates = {};

        if (name !== undefined) {
            if (!String(name).trim()) {
                return res.status(400).json({ error: 'Device name is required' });
            }
            updates.device_name = String(name).trim();
        }

        if (location !== undefined) {
            updates.location = String(location).trim() || null;
        }

        if (hardware !== undefined) {
            const normalized = buildHardwarePayload(hardware);

            if (normalized.num_relays < 1 || normalized.num_relays > 16) {
                return res.status(400).json({ error: 'Relay count must be between 1 and 16' });
            }

            if (normalized.num_pir > 16 || normalized.num_acs712 > 16) {
                return res.status(400).json({ error: 'Sensor counts cannot exceed 16 channels' });
            }

            updates.hardware = normalized;
        }

        const result = await deviceService.updateDeviceConfiguration(req.params.id, updates);
        return res.status(200).json(result);

    } catch (err) {
        console.error("Device configuration error:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
