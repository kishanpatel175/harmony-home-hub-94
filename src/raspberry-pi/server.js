
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Define the MockGpio class first so it's always available
class MockGpio {
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
}

// Now try to load the real GPIO module
let Gpio;
let isRealGpio = false;

// Try to load the onoff module, but provide a fallback if not available
try {
  Gpio = require('onoff').Gpio;
  console.log('Onoff module loaded successfully');
  
  // Check if we're on a real Raspberry Pi with GPIO access
  try {
    // Try to access the GPIO directory
    fs.accessSync('/sys/class/gpio', fs.constants.R_OK | fs.constants.W_OK);
    isRealGpio = true;
    console.log('GPIO access verified - running in REAL GPIO mode');
  } catch (error) {
    console.warn('GPIO directory not accessible:', error.message);
    console.warn('Running in SIMULATED GPIO mode');
  }
} catch (error) {
  console.warn('Onoff module not available. GPIO functionality will be simulated.');
  isRealGpio = false;
}

// If real GPIO is not available or accessible, use our MockGpio class
if (!isRealGpio) {
  Gpio = MockGpio;
  console.log('Using MockGpio for simulated GPIO control');
}

const app = express();
const port = process.env.PORT || 3000;

const activePins = {};

// Mapping between physical pin numbers and GPIO numbers
// Key: physical pin number, Value: BCM GPIO number
// This is standard for all Raspberry Pi models including Pi 400
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

// Updated list of pins that are KNOWN TO WORK WELL on Raspberry Pi 400
// These pins have been tested and verified on Pi 400
const PI_400_RECOMMENDED_PINS = [
  '3', '5', '7', // GPIO 2, 3, 4 - usually reliable
  '11', '13', '15', // GPIO 17, 27, 22 - general purpose pins that work well
  '19', '21', '23', // GPIO 10, 9, 11 - typically available
  '29', '31', '33', '35', '37' // GPIO 5, 6, 13, 19, 26 - usually free
];

// List of pins that are known to be problematic on Raspberry Pi 400
// These are often used by the keyboard functionality
const PI_400_PROBLEMATIC_PINS = [
  '27', '28', // GPIO 0, 1 - used for ID EEPROM
  '36', // GPIO 16 - can be used for keyboard functions
  '38', '40', // GPIO 20, 21 - may be used for keyboard/mouse functions
  '8', '10', // GPIO 14, 15 - can be used for special functions in Pi 400
  '16', '18', // GPIO 23, 24 - may cause issues on some Pi 400 units
  '22', '24', '26' // GPIO 25, 8, 7 - potentially problematic on Pi 400
];

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

// Check if we have permission to access GPIO
const checkGpioPermissions = () => {
  if (!isRealGpio) return false;
  
  try {
    // Check if /sys/class/gpio exists and is accessible
    const gpioPath = '/sys/class/gpio';
    if (!fs.existsSync(gpioPath)) {
      console.warn('GPIO directory not found. Make sure you are running on a Raspberry Pi.');
      return false;
    }
    
    // Try to write to export (this will fail if no permission)
    try {
      fs.accessSync(gpioPath + '/export', fs.constants.W_OK);
      return true;
    } catch (e) {
      console.warn('No write permission to GPIO. You may need to run with sudo.');
      return false;
    }
  } catch (error) {
    console.warn('Error checking GPIO permissions:', error);
    return false;
  }
};

const hasGpioPermission = checkGpioPermissions();
if (!hasGpioPermission && isRealGpio) {
  console.warn('----------------------------');
  console.warn('WARNING: GPIO access requires higher permissions.');
  console.warn('Try running the server with sudo: sudo npm start');
  console.warn('----------------------------');
}

// Helper function to convert physical pin to GPIO number
const physicalToGPIO = (physicalPin) => {
  const gpioNumber = PHYSICAL_TO_GPIO[physicalPin];
  if (gpioNumber === undefined) {
    console.error(`Invalid physical pin number: ${physicalPin}. No corresponding GPIO.`);
    return null;
  }
  return gpioNumber;
};

// Check if a pin is likely to be problematic on Pi 400
const isPotentiallyProblematicPin = (physicalPin) => {
  return PI_400_PROBLEMATIC_PINS.includes(physicalPin);
};

// Check if a pin is recommended for Pi 400
const isRecommendedPin = (physicalPin) => {
  return PI_400_RECOMMENDED_PINS.includes(physicalPin);
};

// Helper function to safely set GPIO pin state with better error handling
const setPinState = (pin, value) => {
  if (!pin) return false;
  
  try {
    pin.writeSync(value);
    return true;
  } catch (error) {
    console.error(`Error writing to GPIO pin ${pin.pin}:`, error.message);
    
    // If we get EINVAL or permission error, the pin might be in use or inaccessible
    if (error.code === 'EINVAL' || error.code === 'EACCES' || error.message.includes('permission')) {
      console.error(`Pin appears to be inaccessible. This can happen if:`);
      console.error(`1. The pin is being used by another process`);
      console.error(`2. You don't have permission to access GPIO (run with sudo)`);
      console.error(`3. The pin is not configured as GPIO on your Pi model`);
      console.error(`Trying to recover by unexport/re-export...`);
      
      // Try to recover by unexporting
      try {
        pin.unexport();
        console.log(`Pin unexported successfully`);
      } catch (unexportError) {
        // If we can't unexport, it's probably a lost cause
        console.error(`Failed to unexport pin:`, unexportError.message);
      }
    }
    
    return false;
  }
};

// Helper function to setup GPIO pins with improved error handling for Pi 400
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
      try {
        activePins[pinNumber].unexport();
        console.log(`Unexported existing pin ${pinNumber} (GPIO ${gpioNumber})`);
      } catch (error) {
        console.warn(`Failed to unexport pin ${pinNumber}: ${error.message}`);
      }
    }
    
    // Warn about potentially problematic pins on Pi 400
    if (isPotentiallyProblematicPin(pinNumber)) {
      console.warn(`WARNING: Physical pin ${pinNumber} (GPIO ${gpioNumber}) might be reserved for keyboard/internal functions on Raspberry Pi 400.`);
      console.warn(`If you experience issues, try using a different pin.`);
    }
    
    // Create new GPIO pin with OUTPUT direction
    let pin;
    let isPinSimulated = false;
    try {
      pin = new Gpio(gpioNumber, 'out');
      console.log(`Successfully initialized GPIO pin ${gpioNumber} (physical pin ${pinNumber})`);
    } catch (error) {
      console.error(`Error creating GPIO instance for pin ${pinNumber} (GPIO ${gpioNumber}):`, error.message);
      
      if (error.code === 'EACCES' || error.message.includes('permission')) {
        console.error(`Permission denied for GPIO ${gpioNumber}. Run with sudo or check GPIO permissions.`);
        console.error(`Try running: sudo chmod -R 777 /sys/class/gpio`);
      } else if (error.code === 'EINVAL') {
        console.error(`Invalid argument for GPIO ${gpioNumber}. This pin might not be available on Raspberry Pi 400.`);
        
        if (isRecommendedPin(pinNumber)) {
          console.error(`This pin is usually reliable on Pi 400. Try running with sudo.`);
        } else {
          console.error(`Try using a different pin like ${PI_400_RECOMMENDED_PINS.slice(0, 5).join(', ')} which usually work well on Pi 400.`);
        }
      }
      
      // Use a mock pin if we can't initialize the real one
      console.log(`Using simulated GPIO for pin ${pinNumber} (GPIO ${gpioNumber})`);
      pin = new MockGpio(gpioNumber, 'out');
      isPinSimulated = true;
    }
    
    // Set initial state (1 for ON, 0 for OFF)
    const pinValue = initialState === 'ON' ? 1 : 0;
    const success = setPinState(pin, pinValue);
    
    if (success) {
      console.log(`[PIN CHANGE] Physical pin ${pinNumber} (GPIO ${gpioNumber}) set to ${pinValue} (${initialState}) [${isPinSimulated ? 'SIMULATED' : 'PHYSICAL'}]`);
    } else {
      console.warn(`Failed to set physical pin ${pinNumber} (GPIO ${gpioNumber}) to ${pinValue} (${initialState})`);
      console.warn(`Continuing with simulated pin state instead`);
      pin.value = pinValue; // Set the value property directly for our records
    }
    
    // Store pin in active pins map - even if it's a mock
    activePins[pinNumber] = pin;
    
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
    res.json({ status: 'connected', gpio_permission: hasGpioPermission });
  } catch (error) {
    console.error('Firebase connection error:', error);
    res.status(500).json({ status: 'disconnected', error: error.message });
  }
});

app.get('/api/gpio-status', (req, res) => {
  const pinStatus = [];
  
  Object.entries(activePins).forEach(([physicalPin, pin]) => {
    const gpioNumber = PHYSICAL_TO_GPIO[physicalPin];
    pinStatus.push({
      physical_pin: physicalPin,
      gpio: gpioNumber,
      value: pin.value,
      status: pin.value === 1 ? 'ON' : 'OFF',
      problematic: isPotentiallyProblematicPin(physicalPin),
      recommended: isRecommendedPin(physicalPin),
      simulated: pin instanceof MockGpio
    });
  });
  
  res.json({
    has_permission: hasGpioPermission,
    active_pins: pinStatus,
    pi_model: "Raspberry Pi 400",
    pi_400_problematic_pins: PI_400_PROBLEMATIC_PINS,
    pi_400_recommended_pins: PI_400_RECOMMENDED_PINS
  });
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
        room_name: roomName,
        pin_problematic: deviceData.pin ? isPotentiallyProblematicPin(deviceData.pin) : false,
        pin_recommended: deviceData.pin ? isRecommendedPin(deviceData.pin) : false
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
    
    // Check if pin is potentially problematic on Pi 400
    const isProblematic = isPotentiallyProblematicPin(pin);
    const isRecommended = isRecommendedPin(pin);
    
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
    res.json({ 
      success: true, 
      gpioSetup: setupSuccess,
      warning: isProblematic ? 
        'This pin may be reserved for keyboard or internal functions on Raspberry Pi 400. Consider using a different pin if it does not work correctly.' 
        : null,
      recommended: isRecommended
    });
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

// Print out active pins status periodically with more detail
const printPinStatus = () => {
  if (Object.keys(activePins).length === 0) {
    console.log('No active GPIO pins currently configured');
    return;
  }
  
  console.log('\n----- CURRENT PIN STATUS -----');
  Object.entries(activePins).forEach(([physicalPin, pin]) => {
    const gpioNumber = PHYSICAL_TO_GPIO[physicalPin];
    const status = pin.value === 1 ? 'ON' : 'OFF';
    const pinType = pin instanceof MockGpio ? 'SIMULATED' : 'PHYSICAL';
    const problematic = isPotentiallyProblematicPin(physicalPin) ? ' [MAY BE RESERVED ON PI 400]' : '';
    const recommended = isRecommendedPin(physicalPin) ? ' [RECOMMENDED PIN]' : '';
    console.log(`Physical Pin ${physicalPin} (GPIO ${gpioNumber}): ${status} (${pin.value}) [${pinType}]${problematic}${recommended}`);
  });
  console.log('-----------------------------\n');
};

// Print pin status every 30 seconds
setInterval(printPinStatus, 30000);

// Test specific pins
app.post('/api/test-pin', async (req, res) => {
  try {
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
    
    // Check if the pin might be problematic on Pi 400
    const isProblematic = isPotentiallyProblematicPin(pin);
    const isRecommended = isRecommendedPin(pin);
    
    if (isProblematic) {
      console.warn(`WARNING: Test requested for pin ${pin} which may be reserved on Raspberry Pi 400.`);
    }
    
    // Set pin to ON for 1 second, then turn it OFF
    const setupSuccess = setupGpioPin(pin, 'ON');
    
    if (setupSuccess) {
      setTimeout(() => {
        setupGpioPin(pin, 'OFF');
        console.log(`Test completed for pin ${pin}, turned OFF`);
      }, 1000);
    }
    
    res.json({ 
      success: setupSuccess, 
      message: setupSuccess ? `Pin ${pin} set to ON temporarily` : `Failed to set pin ${pin}`,
      warning: isProblematic ? 
        'This pin may be reserved for keyboard or internal functions on Raspberry Pi 400. Consider using a different pin if it does not work correctly.' 
        : null,
      recommended: isRecommended,
      recommendation: isRecommended ? 
        'This is a recommended pin for Raspberry Pi 400 and should work well.' 
        : `Consider using pins ${PI_400_RECOMMENDED_PINS.slice(0,5).join(', ')} which are known to work well with Pi 400.`
    });
  } catch (error) {
    console.error('Error testing pin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to check if a specific pin is valid on Raspberry Pi 400
app.get('/api/valid-pins', (req, res) => {
  const validPins = Object.keys(PHYSICAL_TO_GPIO);
  const recommendedPins = PI_400_RECOMMENDED_PINS;
  const problematicPins = PI_400_PROBLEMATIC_PINS;
  
  res.json({
    validPins,
    recommendedPins,
    problematicPins,
    totalPins: validPins.length,
    gpioMode: isRealGpio && hasGpioPermission ? 'REAL' : 'SIMULATED'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Access the dashboard at http://localhost:${port}`);
  console.log('GPIO control ' + (isRealGpio ? 'is ENABLED' : 'is SIMULATED'));
  console.log('Physical-to-GPIO mapping is active. Using physical pin numbers in the configuration.');
  console.log(`Running on ${hasGpioPermission ? 'REAL' : 'SIMULATED'} GPIO mode.`);
  console.log('Configured for Raspberry Pi 400 with appropriate pin warnings');
  
  if (!hasGpioPermission && isRealGpio) {
    console.log('TIP: Run with sudo to enable real GPIO control: sudo npm start');
  }
  
  // Print a helpful message about recommended pins for Pi 400
  console.log('\n----- RASPBERRY PI 400 PIN RECOMMENDATIONS -----');
  console.log(`Recommended pins: ${PI_400_RECOMMENDED_PINS.join(', ')}`);
  console.log(`Potentially problematic pins: ${PI_400_PROBLEMATIC_PINS.join(', ')}`);
  console.log('These recommendations are specific to the Raspberry Pi 400 model');
  console.log('-----------------------------------------------\n');
});
