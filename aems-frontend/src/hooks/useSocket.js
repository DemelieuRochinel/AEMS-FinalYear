// ═══════════════════════════════════════════════════════════
//  WEBSOCKET HOOK
//  Connects to AEMS backend Socket.io
//  Provides live sensor data to any component that uses it
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useSocket = () => {
  const socketRef    = useRef(null);
  const [connected,  setConnected]  = useState(false);
  const [liveReading, setLiveReading] = useState(null);
  const [roomUpdates, setRoomUpdates] = useState([]);
  const [alerts,      setAlerts]      = useState([]);
  const [deviceStatus,setDeviceStatus]= useState({});

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    // ── Live sensor data (every 5 seconds from ESP32)
        socket.on('sensor_data', (data) => {
      setLiveReading(data);
    });

    // ── Room relay state changed
    socket.on('room_update', (data) => {
      setRoomUpdates(prev => [data, ...prev].slice(0, 50));
    });

    // ── Alert triggered by automation engine
    socket.on('alert_triggered', (data) => {
      setAlerts(prev => [{ ...data, id: Date.now() }, ...prev].slice(0, 20));
    });

    // ── Device online/offline
    socket.on('device_status', (data) => {
      setDeviceStatus(prev => ({
        ...prev,
        [data.deviceId]: data.status,
      }));
    });

    // ── Alert resolved
    socket.on('alert_resolved', (data) => {
      setAlerts(prev => prev.filter(a => a.alertId !== data.alertId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Send relay command from dashboard
  const sendCommand = (deviceId, relayId, action) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('control_device', {
        device_id: deviceId,
        relay_id:  relayId,
        action,
      });
    }
  };

  return {
    connected,
    liveReading,
    roomUpdates,
    alerts,
    deviceStatus,
    sendCommand,
  };
};