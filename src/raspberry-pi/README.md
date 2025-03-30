
# Raspberry Pi Home Automation Server

This server runs on a Raspberry Pi and connects to Firebase to control your home automation system.

## Setup Instructions

### Prerequisites

1. Raspberry Pi (including Pi 400) with Raspbian OS installed
2. Node.js (v14 or newer) installed on your Raspberry Pi
3. Firebase Admin SDK service account key

### Installation Steps

1. Copy the entire `raspberry-pi` folder to your Raspberry Pi

2. Place your `serviceAccountKey.json` file in the root of the `raspberry-pi` folder
   - This file contains credentials for the Firebase Admin SDK
   - You can download this file from the Firebase Console

3. Install dependencies:
   ```bash
   cd raspberry-pi
   npm install
   ```

   > **Note**: The `onoff` package for GPIO control is included in the dependencies and should be installed automatically. If you encounter any issues with it, you may need to install it manually with `npm install onoff`.

4. Start the server:
   ```bash
   sudo npm start
   ```

   > **Important**: Running with `sudo` is required for GPIO access. If you don't use sudo, the system will fall back to simulated GPIO mode.

5. Access the web interface:
   - Open a browser on your Raspberry Pi or any device on the same network
   - Go to `http://<raspberry-pi-ip-address>:3000`
   - For example: `http://192.168.1.100:3000` or `http://localhost:3000` if accessing from the Pi itself

### Raspberry Pi 400 Specific Notes

The Raspberry Pi 400 has the same GPIO pin layout as other Raspberry Pi models, but since it's built into a keyboard, certain pins are used by the keyboard functionality:

#### Best Pins to Use on Pi 400

For the most reliable operation on Raspberry Pi 400, use these physical pins:
- **Highly Recommended**: 3, 5, 7, 11, 13, 15, 19, 21, 23, 29, 31, 33, 35, 37
- These pins have been tested and verified to work reliably with Pi 400

#### Pins to Avoid on Pi 400

The following pins may be problematic on Raspberry Pi 400 as they may be used by the keyboard:
- **Potentially Problematic**: 8, 10, 16, 18, 22, 24, 26, 27, 28, 36, 38, 40
- If you must use these pins, the system will automatically fall back to simulated mode

#### GPIO Access on Pi 400

- Some pins on the Pi 400 will show "EINVAL: invalid argument" errors
- This is normal and the system automatically handles this by switching to simulated mode
- To maximize real GPIO access, always run with `sudo npm start`

### GPIO Control and Status Monitoring

The server automatically uses the `onoff` package to control GPIO pins based on device status changes in Firebase. When a device status changes, the server will:

1. Convert the physical pin number to the corresponding GPIO number
2. Update the GPIO pin's state (HIGH for ON, LOW for OFF)
3. Log the change in the console for validation

The server displays real-time status updates in the console:
- When a device status changes, detailed logs show the pin being updated
- Every 30 seconds, a summary of all active pins and their current states is printed
- During panic mode, all pin state changes are logged

#### Raspberry Pi Pin Mapping

This system uses **physical pin numbers** (the actual pin position on the Raspberry Pi board) in the interface, which are then mapped to the correct GPIO numbers internally.

Valid physical pin numbers that can be used in the interface:

- 3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 35, 36, 37, 38, 40

Here's the mapping between physical pins and GPIO numbers for reference:

| Physical Pin | GPIO Number | Pi 400 Compatibility |
|--------------|-------------|----------------------|
| 3            | 2           | Recommended          |
| 5            | 3           | Recommended          |
| 7            | 4           | Recommended          |
| 8            | 14          | May have issues      |
| 10           | 15          | May have issues      |
| 11           | 17          | Recommended          |
| 12           | 18          | Generally works      |
| 13           | 27          | Recommended          |
| 15           | 22          | Recommended          |
| 16           | 23          | May have issues      |
| 18           | 24          | May have issues      |
| 19           | 10          | Recommended          |
| 21           | 9           | Recommended          |
| 22           | 25          | May have issues      |
| 23           | 11          | Recommended          |
| 24           | 8           | May have issues      |
| 26           | 7           | May have issues      |
| 27           | 0           | Avoid (ID EEPROM)    |
| 28           | 1           | Avoid (ID EEPROM)    |
| 29           | 5           | Recommended          |
| 31           | 6           | Recommended          |
| 32           | 12          | Generally works      |
| 33           | 13          | Recommended          |
| 35           | 19          | Recommended          |
| 36           | 16          | Avoid (keyboard)     |
| 37           | 26          | Recommended          |
| 38           | 20          | Avoid (keyboard)     |
| 40           | 21          | Avoid (keyboard)     |

You can configure specific GPIO pin mappings for your devices through the web interface. Only enter pin numbers from the list above.

### Validating Pin Control

To verify that your GPIO pins are working correctly:

1. Watch the console output for log messages like:
   ```
   [PIN CHANGE] Physical pin 11 (GPIO 17) set to 1 (ON) [PHYSICAL]
   ```

2. Every 30 seconds, check the pin status summary that looks like:
   ```
   ----- CURRENT PIN STATUS -----
   Physical Pin 11 (GPIO 17): ON (1) [PHYSICAL] [RECOMMENDED PIN]
   Physical Pin 13 (GPIO 27): OFF (0) [SIMULATED]
   -----------------------------
   ```
   Note: [PHYSICAL] means the pin is being controlled directly, while [SIMULATED] means the pin is in mock mode.

3. Use a multimeter or LED connected to the appropriate GPIO pins to verify the voltage changes from 0V (OFF) to 3.3V (ON)

4. If you change a device status in the web interface, check that the corresponding log appears showing the pin state change

5. Use the "Test Pin" feature in the web interface to toggle a specific pin ON and OFF for testing

### Troubleshooting

#### GPIO Permission Issues

The most common issue is permissions for GPIO access. If you see errors like `EINVAL: invalid argument, write`, try these solutions:

1. **Run the server with sudo** (recommended method):
   ```bash
   sudo npm start
   ```

2. **Use recommended pins for Pi 400**:
   - Use pins 3, 5, 7, 11, 13, 15, 19, 21, 23, 29, 31, 33, 35, 37 which work reliably on Pi 400
   - Avoid pins 8, 10, 16, 18, 22, 24, 26, 27, 28, 36, 38, 40 which may conflict with keyboard

3. **Check for pin conflicts**:
   - Some pins might be used by other services or have specific functions
   - Use `gpio readall` command to see current pin states (install wiringpi if needed)

4. **Change GPIO permissions** (alternative solution):
   ```bash
   sudo chmod -R 777 /sys/class/gpio
   ```
   Then restart the server with regular permissions:
   ```bash
   npm start
   ```

5. **Add your user to the gpio group** (permanent solution):
   ```bash
   sudo usermod -a -G gpio $USER
   ```
   You'll need to log out and back in for this to take effect.

#### Simulated Mode

If you see "Using MockGpio for simulated GPIO control" in the logs, this means:
- The system couldn't access real GPIO pins and is running in simulation mode
- All pin changes will be logged but no actual hardware control will happen
- This is perfectly fine for testing or when you don't need physical control

If you want to switch from simulated to real mode:
1. Run with sudo: `sudo npm start`
2. Make sure onoff is correctly installed: `npm install onoff`
3. Check that you're using pins that are available on your Pi model (see table above)

#### Other Common Issues

- If you see connection errors, verify that your `serviceAccountKey.json` is valid
- Make sure your Raspberry Pi has internet access to connect to Firebase
- If specific pins are not working, try using one of the recommended pins from the table above
- For deeper debugging, set the environment variable `DEBUG=1` when running: `DEBUG=1 sudo npm start`

### Automatic Startup

To make the server start automatically when your Raspberry Pi boots:

1. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/home-automation.service
   ```

2. Add the following content (adjust paths as needed):
   ```
   [Unit]
   Description=Home Automation Server
   After=network.target

   [Service]
   ExecStart=/usr/bin/node /home/pi/raspberry-pi/server.js
   WorkingDirectory=/home/pi/raspberry-pi
   StandardOutput=inherit
   StandardError=inherit
   Restart=always
   User=root

   [Install]
   WantedBy=multi-user.target
   ```

   > **Note**: We're setting User=root here to ensure GPIO access permissions.

3. Enable and start the service:
   ```bash
   sudo systemctl enable home-automation.service
   sudo systemctl start home-automation.service
   ```

4. Check status:
   ```bash
   sudo systemctl status home-automation.service
   ```

### Testing GPIO Pins

The server includes a test endpoint that allows you to temporarily activate any GPIO pin to verify it's working:

1. Use the "Test Pin" feature in the web interface
2. Or send a POST request to `/api/test-pin` with JSON body `{"pin": "11"}` (replace 11 with your desired physical pin)
3. The pin will turn ON for 1 second, then turn OFF
4. Check the server console for confirmation that the test was executed

This test function is useful for verifying hardware connections without changing device status in Firebase.
