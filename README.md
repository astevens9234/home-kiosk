# Raspberry Pi Home Kiosk Application

A premium, responsive, glassmorphic dashboard designed to run on a Raspberry Pi 4 and display over the local network to a tablet. Built using a Python FastAPI backend and a clean, responsive HTML5/Vanilla CSS/JavaScript frontend.

![Demo Mockup](https://raw.githubusercontent.com/username/repo/main/mockup.png) <!-- Replace or keep as placeholder -->

## Features
- **Modern Glassmorphic Dark UI**: Translucent cards, subtle gradient background blobs, glowing accent borders, and micro-interactions.
- **Dynamic Clock & Date**: Clean digital readout.
- **Live Local Weather**: Custom weather widget showing current conditions and a 3-day forecast fetched directly from the Open-Meteo API.
- **Google Calendar Custom UI**: A sleek list of upcoming events matching the theme. Displays in Demo Mode with mock events and setup instructions out-of-the-box.
- **Pi System Health**: Real-time stats (CPU Load, CPU Temperature, Memory usage, Disk usage, and Uptime) via a Python API.
- **Interactive Canvas Chart**: High-performance, pixel-sharp Canvas graph displaying CPU and RAM history.
- **Quick Controls**: High-contrast bedside **Dim Mode** filter (shifts screen opacity/warmth for night viewing) and reload/refresh triggers.

---

## 1. Quick Start (Local Setup)

To test the application on your computer or Pi, run:

```bash
# 1. Clone or navigate to the directory
cd home-kiosk

# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Start the FastAPI server
python backend/main.py
```

Open [http://localhost:8000](http://localhost:8000) in your web browser. The app will boot into **Demo Mode** showing simulated calendar events and local system specs.

---

## 2. Google Calendar API Integration Setup

To replace the simulated events with your live Google Calendar feed:

### Step 2.1: Enable API & Download Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "Home Kiosk").
3. Search for **Google Calendar API** and click **Enable**.
4. Configure the **OAuth Consent Screen**:
   - Select **External** user type.
   - Fill in the App Name and user support email.
   - In the **Scopes** page, add `.../auth/calendar.readonly`.
   - In the **Test users** page, add the Gmail address of the account holding the calendar.
5. Generate credentials:
   - Go to **Credentials** > click **+ Create Credentials** > select **OAuth client ID**.
   - Choose Application Type: **Desktop app**.
   - Click **Create** and download the client secrets JSON.
6. Rename the downloaded file to `credentials.json` and place it inside the `backend/` directory:
   `home-kiosk/backend/credentials.json`

### Step 2.2: Perform One-time Authentication
Since the kiosk tablet is a remote display, perform the authorization on a computer or directly in the terminal:
- **Option A (Desktop/SSH Forwarding)**:
  Run the authentication helper script:
  ```bash
  python backend/auth_helper.py
  ```
  This will open a local web browser page asking you to sign in with your Google account. Once accepted, it writes `token.json` into the `backend/` folder and closes.
- **Option B (Headless Server)**:
  If the Pi is running headless and you cannot run the browser local server, run `auth_helper.py` on your desktop/laptop (with `credentials.json` present), complete the auth flow there, and copy the resulting `token.json` file over to the Pi's `backend/` folder.

Once `token.json` is generated, restart the FastAPI server, and the dashboard status will shift to **Calendar Live**.

---

## 3. Running as a Background Service on Raspberry Pi (systemd)

To ensure the FastAPI backend starts automatically when the Raspberry Pi boots, register it as a systemd service:

1. Create a service file:
   ```bash
   sudo nano /etc/systemd/system/home-kiosk.service
   ```
2. Paste the following configuration (replace `pi` with your OS username and paths with your exact workspace locations):
   ```ini
   [Unit]
   Description=Home Kiosk FastAPI Server
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/home-kiosk
   ExecStart=/usr/bin/python3 backend/main.py
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```
3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable home-kiosk.service
   sudo systemctl start home-kiosk.service
   ```
4. Verify status:
   ```bash
   sudo systemctl status home-kiosk.service
   ```

---

## 4. Raspberry Pi Fullscreen Kiosk Mode Setup

To configure the Raspberry Pi 4 to boot directly into a full-screen browser pointing to the dashboard (at `http://localhost:8000`):

### Step 4.1: Enable Auto-Login
1. Run Raspberry Pi configuration: `sudo raspi-config`.
2. Go to **System Options** > **Boot / Auto Login**.
3. Select **Desktop Autologin** (automatically logs into the graphical desktop as user `pi`).
4. Save and select Reboot.

### Step 4.2: Configure Autostart (X11 / Openbox - Bullseye and older OS versions)
If your Pi uses the X11 display server:
1. Open the autostart config:
   ```bash
   nano ~/.config/lxsession/LXDE-pi/autostart
   ```
2. Append the following lines to disable screen blanking, hide the cursor, and load Chromium in kiosk mode:
   ```bash
   # Prevent screen blanking/sleep
   @xset s off
   @xset -dpms
   @xset s noblank

   # Start Chromium in fullscreen kiosk mode
   @chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 http://localhost:8000
   ```

### Step 4.3: Configure Autostart (Wayland / Wayfire - Bookworm and newer OS versions)
If your Pi uses the newer Wayland window manager:
1. Open the Wayfire configuration file:
   ```bash
   nano ~/.config/wayfire.ini
   ```
2. Find or add the `[autostart]` section and include these commands:
   ```ini
   [autostart]
   # Turn off screen power saving
   screensaver = false
   dpms = false
   
   # Run Chromium in fullscreen kiosk mode on startup
   kiosk = chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 http://localhost:8000
   ```

### Step 4.4: Preventing Screen Blanking (General)
If the screen still falls asleep after a few minutes, install and configure `xscreensaver` (X11 only):
```bash
sudo apt-get install xscreensaver
```
Open `xscreensaver` from the desktop preferences and select **Disable Screen Saver**.
