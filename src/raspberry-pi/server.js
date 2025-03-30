
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
let Gpio;

// Try to load the onoff module, but provide a fallback if not available
try {
  Gpio = require('onoff').Gpio;
  console.log('Onoff module loaded successfully');
} catch (error) {
  console.warn('Onoff module not available. GPIO functionality will be simulated.');
  // Create a mock Gpio class for testing on non-Pi hardware
  Gpio = class MockGpio {
    constructor(pin, direction) {
      this.pin = pin;
      this.direction = direction;
      this.value = 0;
      console.log(`[MOCK] GPIO pin ${pin} initialized with direction ${direction}`);
    }
    
    writeSync(value) {
      this.value = value;
      console.log(`[MOCK] GPIO pin ${this.pin} set to ${value}`);
    }
    
    unexport() {
      console.log(`[MOCK] GPIO pin ${this.pin} unexported`);
    }
  };
}

const app = express();
const port = process.env.PORT || 3000;

const activePins = {};

// Mapping between physical pin numbers and GPIO numbers
// Key: physical pin number, Value: BCM GPIO number
const PHYSICAL_TO_GPIO = {
  // Physical : GPIO
  '3': 2,
  '5': 3,
  '7': 4,
  '8': 14,
  '10': 15,
  '11': 17,
  '12': 18,
  '13': 27,
  '15': 22,
  '16': 23,
  '18': 24,
  '19': 10,
  '21': 9,
  '22': 25,
  '23': 11,
  '24': 8,
  '26': 7,
  '27': 0,
  '28': 1,
  '29': 5,
  '31': 6,
  '32': 12,
  '33': 13,
  '35': 19,
  '36': 16,
  '37': 26,
  '38': 20,
  '40': 21
};

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

// Helper function to convert physical pin to GPIO number
const physicalToGPIO = (physicalPin) => {
  const gpioNumber = PHYSICAL_TO_GPIO[physicalPin];
  if (gpioNumber === undefined) {
    console.error(`Invalid physical pin number: ${physicalPin}. No corresponding GPIO.`);
    return null;
  }
  return gpioNumber;
};

// Helper function to setup GPIO pins
const setupGpioPin = (pinNumber, initialState) => {
  try {
    // Convert physical pin number to GPIO number
    const gpioNumber = physicalToGPIO(pinNumber);
    
    if (gpioNumber === null) {
      console.warn(`Skipping setup for invalid pin ${pinNumber}`);
      return false;
    }
    
    // Clean up if pin was already initialized
    if (activePins[pinNumber]) {
      activePins[pinNumber].unexport();
      console.log(`Unexported existing pin ${pinNumber} (GPIO ${gpioNumber})`);
    }
    
    // Create new GPIO pin with OUTPUT direction
    const pin = new Gpio(gpioNumber, 'out');
    
    // Set initial state (1 for ON, 0 for OFF)
    const pinValue = initialState === 'ON' ? 1 : 0;
    pin.writeSync(pinValue);
    
    // Store pin in active pins map
    activePins[pinNumber] = pin;
    
    console.log(`[PIN CHANGE] Physical pin ${pinNumber} (GPIO ${gpioNumber}) set to ${pinValue} (${initialState})`);
    return true;
  } catch (error) {
    console.error(`Error setting up GPIO pin ${pinNumber}:`, error);
    return false;
  }
};

// Set up device status listener for real-time updates
const setupDeviceListeners = async () => {
  try {
    // First get all devices to set up initial pins
    const devicesRef = db.collection('devices');
    const snapshot = await devicesRef.get();
    
    console.log("Initial device setup:");
    snapshot.forEach(doc => {
      const device = doc.data();
      if (device.pin) {
        console.log(`Setting up device "${device.device_name}" with physical pin ${device.pin}, status: ${device.device_status}`);
        setupGpioPin(device.pin, device.device_status);
      }
    });
    
    // Then listen for changes
    devicesRef.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const device = change.doc.data();
        if (device.pin) {
          if (change.type === 'modified') {
            console.log(`Device "${device.device_name}" status changed to ${device.device_status}, updating physical pin ${device.pin}`);
            setupGpioPin(device.pin, device.device_status);
          }
        }
      });
    });
    
    console.log('Device listeners set up successfully');
  } catch (error) {
    console.error('Error setting up device listeners:', error);
  }
};

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
    
    // Check if pin is valid (maps to a GPIO)
    if (!PHYSICAL_TO_GPIO[pin]) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid physical pin number ${pin}. Must be one of: ${Object.keys(PHYSICAL_TO_GPIO).join(', ')}` 
      });
    }
    
    const deviceRef = db.collection('devices').doc(deviceId);
    const deviceDoc = await deviceRef.get();
    
    if (!deviceDoc.exists) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceDoc.data();
    
    // Update pin in Firestore
    await deviceRef.update({ pin });
    
    // Set up GPIO pin with current device status
    const setupSuccess = setupGpioPin(pin, device.device_status);
    
    console.log(`Updated pin for device ${deviceId} to ${pin}`);
    res.json({ success: true, gpioSetup: setupSuccess });
  } catch (error) {
    console.error('Error updating pin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/devices/:deviceId/update-status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;
    
    if (!status || (status !== 'ON' && status !== 'OFF')) {
      return res.status(400).json({ success: false, error: 'Valid status (ON/OFF) is required' });
    }
    
    const deviceRef = db.collection('devices').doc(deviceId);
    const deviceDoc = await deviceRef.get();
    
    if (!deviceDoc.exists) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    const device = deviceDoc.data();
    
    // Update status in Firestore
    await deviceRef.update({ device_status: status });
    
    // Update GPIO pin if available
    let gpioSetup = false;
    if (device.pin) {
      gpioSetup = setupGpioPin(device.pin, status);
    }
    
    console.log(`Updated status for device ${deviceId} to ${status}`);
    res.json({ success: true, gpioSetup });
  } catch (error) {
    console.error('Error updating device status:', error);
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

// Listen for panic mode changes and update all GPIO pins
db.collection('panic_mode').doc('current')
  .onSnapshot(async doc => {
    if (doc.exists) {
      const panicMode = doc.data();
      
      if (panicMode.is_panic_mode) {
        console.log('Panic mode activated! Turning off all devices...');
        
        // Get all devices
        const devicesRef = db.collection('devices');
        const snapshot = await devicesRef.get();
        
        // Update all devices to OFF status
        const batch = db.batch();
        
        snapshot.forEach(doc => {
          const deviceRef = devicesRef.doc(doc.id);
          batch.update(deviceRef, { device_status: 'OFF' });
          
          // Turn off GPIO pins
          const device = doc.data();
          if (device.pin && activePins[device.pin]) {
            activePins[device.pin].writeSync(0); // Turn off
            console.log(`[PANIC MODE] Set physical pin ${device.pin} (for device "${device.device_name}") to OFF (0)`);
          }
        });
        
        await batch.commit();
        console.log('All devices turned off due to panic mode');
      }
    }
  });

// Default route for serving the web interface
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize device listeners when server starts
setupDeviceListeners().catch(err => {
  console.error('Failed to set up device listeners:', err);
});

// Clean up GPIO pins on server shutdown
process.on('SIGINT', () => {
  console.log('Cleaning up GPIO pins before exit...');
  
  Object.values(activePins).forEach(pin => {
    try {
      pin.unexport();
    } catch (error) {
      console.error('Error unexporting pin:', error);
    }
  });
  
  process.exit(0);
});

// Print out active pins status periodically
const printPinStatus = () => {
  if (Object.keys(activePins).length === 0) {
    console.log('No active GPIO pins currently configured');
    return;
  }
  
  console.log('\n----- CURRENT PIN STATUS -----');
  Object.entries(activePins).forEach(([physicalPin, pin]) => {
    const gpioNumber = PHYSICAL_TO_GPIO[physicalPin];
    const status = pin.value === 1 ? 'ON' : 'OFF';
    console.log(`Physical Pin ${physicalPin} (GPIO ${gpioNumber}): ${status} (${pin.value})`);
  });
  console.log('-----------------------------\n');
};

// Print pin status every 30 seconds
setInterval(printPinStatus, 30000);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Access the dashboard at http://localhost:${port}`);
  console.log('GPIO control ' + (Gpio.prototype.hasOwnProperty('unexport') ? 'is ENABLED' : 'is SIMULATED'));
  console.log('Physical-to-GPIO mapping is active. Using physical pin numbers in the configuration.');
});
