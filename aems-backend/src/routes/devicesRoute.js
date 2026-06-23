const express = require('express');
const router  = express.Router();

const deviceService = require('../services/deviceService');
const {authenticate} = require('../middleware/authentication');

router.post('/NewDevice', async (req, res) => {
    try{
        const {deviceId,businessId,name} = req.body;

        if(!businessId || !deviceId || !name){
           return res.status(400).json({ error: 'Missing device information!' });
                
            }

            const result = await deviceService.createDevice(deviceId,{
                business_id: businessId,
                device_name: name
            });
            return res.status(201).json(result);

        }catch(err){
            console.error("Backend Error:", err);
            return res.status(500).json({error: err.message});

        }
});
module.exports = router;