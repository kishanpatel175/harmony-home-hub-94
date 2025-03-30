
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

const db = admin.firestore();

// API Endpoints
app.get('/api/check-connection', async (req, res) => {
  try {
    // Test connection to Firebase
    await db.collection('devices').limit(1).get();
    res.json({ status: 'connected' });
  } catch (error) {
    console.error('Firebase connection error:', error);
    res.status(500).json({ status: 'disconnected', error: error.message });
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    const devicesRef = db.collection('devices');
    const snapshot = await devicesRef.get();
    
    const devicesPromises = snapshot.docs.map(async (doc) => {
      const deviceData = doc.data();
      const deviceId = doc.id;
      
      // Get room name if roomId exists
      let roomName = 'Unassigned';
      if (deviceData.roomId) {
        try {
          const roomDoc = await db.collection('rooms').doc(deviceData.roomId).get();
          if (roomDoc.exists) {
            roomName = roomDoc.data().room_name;
          }
        } catch (err) {
          console.error(`Error fetching room for device ${deviceId}:`, err);
        }
      }
      
      return {
        ...deviceData,
        id: deviceId,
        room_name: roomName
      };
    });
    
    const devices = await Promise.all(devicesPromises);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/devices/:deviceId/update-pin', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({ success: false, error: 'Pin is required' });
    }
    
    if (!/^\d+$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'Pin must contain only digits' });
    }
    
    const deviceRef = db.collection('devices').doc(deviceId);
    await deviceRef.update({ pin });
    
    console.log(`Updated pin for device ${deviceId} to ${pin}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating pin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/present-members', async (req, res) => {
  try {
    // Get present members
    const presentRef = db.collection('present_scan');
    const presentSnapshot = await presentRef.get();
    
    const membersPromises = presentSnapshot.docs.map(async (doc) => {
      const memberId = doc.id;
      const memberDoc = await db.collection('members').doc(memberId).get();
      
      if (memberDoc.exists) {
        return {
          ...memberDoc.data(),
          id: memberDoc.id
        };
      }
      return null;
    });
    
    const members = (await Promise.all(membersPromises)).filter(member => member !== null);
    
    // Get privileged user
    const privilegedUserDoc = await db.collection('current_most_privileged_user').doc('current').get();
    let privilegedUser = {};
    
    if (privilegedUserDoc.exists) {
      privilegedUser = privilegedUserDoc.data();
    }
    
    res.json({ members, privilegedUser });
  } catch (error) {
    console.error('Error fetching present members:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/panic-mode', async (req, res) => {
  try {
    const panicModeDoc = await db.collection('panic_mode').doc('current').get();
    
    if (panicModeDoc.exists) {
      res.json(panicModeDoc.data());
    } else {
      res.json({ is_panic_mode: false });
    }
  } catch (error) {
    console.error('Error fetching panic mode:', error);
    res.status(500).json({ error: error.message });
  }
});

// Default route for serving the web interface
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Access the dashboard at http://localhost:${port}`);
});
