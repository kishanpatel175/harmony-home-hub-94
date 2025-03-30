
# Raspberry Pi Home Automation Server

This server runs on a Raspberry Pi and connects to Firebase to control your home automation system.

## Setup Instructions

### Prerequisites

1. Raspberry Pi with Raspbian OS installed
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

4. Start the server:
   ```bash
   npm start
   ```

5. Access the web interface:
   - Open a browser on your Raspberry Pi or any device on the same network
   - Go to `http://<raspberry-pi-ip-address>:3000`
   - For example: `http://192.168.1.100:3000` or `http://localhost:3000` if accessing from the Pi itself

### GPIO Control

To control actual GPIO pins on your Raspberry Pi, you'll need to:

1. Install the `onoff` package:
   ```bash
   npm install onoff
   ```

2. Uncomment and modify the GPIO control code in the `server.js` file to match your hardware setup

### Troubleshooting

- If you see connection errors, verify that your `serviceAccountKey.json` is valid
- Make sure your Raspberry Pi has internet access to connect to Firebase
- Check that all device pin numbers correspond to valid GPIO pins on your Raspberry Pi model

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
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl enable home-automation.service
   sudo systemctl start home-automation.service
   ```

4. Check status:
   ```bash
   sudo systemctl status home-automation.service
   ```
