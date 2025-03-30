
const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const cors = require('cors');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('Firebase initialized successfully');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to check connection
app.get('/api/check-connection', (req, res) => {
  res.json({ status: 'connected', message: 'Successfully connected to Firebase' });
});

// API endpoint to get devices
app.get('/api/devices', async (req, res) => {
  try {
    const devicesSnapshot = await db.collection('devices').get();
    const devices = [];
    
    for (const doc of devicesSnapshot.docs) {
      const device = { id: doc.id, ...doc.data() };
      
      // Get room name if roomId exists
      if (device.roomId) {
        const roomDoc = await db.collection('rooms').doc(device.roomId).get();
        if (roomDoc.exists) {
          device.room_name = roomDoc.data().room_name;
        } else {
          device.room_name = 'Unassigned';
        }
      } else {
        device.room_name = 'Unassigned';
      }
      
      devices.push(device);
    }
    
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// API endpoint to update device pin
app.post('/api/devices/:deviceId/update-pin', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin } = req.body;
    
    if (!pin || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'Pin must be a valid number' });
    }
    
    await db.collection('devices').doc(deviceId).update({ pin });
    res.json({ success: true, message: 'Pin updated successfully' });
  } catch (error) {
    console.error('Error updating pin:', error);
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

// API endpoint to get present members
app.get('/api/present-members', async (req, res) => {
  try {
    const presentSnapshot = await db.collection('present_scan').get();
    const members = [];
    
    for (const doc of presentSnapshot.docs) {
      const memberId = doc.id;
      const memberDoc = await db.collection('members').doc(memberId).get();
      
      if (memberDoc.exists) {
        members.push({ id: memberId, ...memberDoc.data() });
      }
    }
    
    // Get privileged user
    const privilegedUserDoc = await db.collection('current_most_privileged_user').doc('current').get();
    const privilegedUser = privilegedUserDoc.exists ? privilegedUserDoc.data() : { current_most_privileged_user_id: '', current_privileged_role: '' };
    
    res.json({ members, privilegedUser });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// API endpoint to get panic mode status
app.get('/api/panic-mode', async (req, res) => {
  try {
    const panicModeDoc = await db.collection('panic_mode').doc('current').get();
    const panicMode = panicModeDoc.exists ? panicModeDoc.data() : { is_panic_mode: false };
    
    res.json(panicMode);
  } catch (error) {
    console.error('Error fetching panic mode:', error);
    res.status(500).json({ error: 'Failed to fetch panic mode status' });
  }
});

// Control GPIO pins (placeholder for actual GPIO control)
app.post('/api/control-device', async (req, res) => {
  try {
    const { deviceId, status } = req.body;
    
    if (!deviceId || (status !== 'ON' && status !== 'OFF')) {
      return res.status(400).json({ error: 'Invalid device ID or status' });
    }
    
    // Get the device
    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    
    if (!deviceDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const device = deviceDoc.data();
    
    // Here you would add code to control the actual GPIO pin
    // For example:
    // const GPIO = require('onoff').Gpio;
    // const pin = new GPIO(device.pin, 'out');
    // pin.writeSync(status === 'ON' ? 1 : 0);
    
    console.log(`Setting device ${device.device_name} (pin ${device.pin}) to ${status}`);
    
    // Update the device status in Firebase
    await db.collection('devices').doc(deviceId).update({ device_status: status });
    
    res.json({ success: true, message: `Device ${deviceId} set to ${status}` });
  } catch (error) {
    console.error('Error controlling device:', error);
    res.status(500).json({ error: 'Failed to control device' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the Raspberry Pi interface at http://localhost:${PORT}`);
});
