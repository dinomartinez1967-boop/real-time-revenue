# OpenDroid Sandbox — Termux Native Guide

Run the whole simulation (FastAPI + engine) directly on your Galaxy S24 FE
inside Termux, and open the React panel from the Samsung DeX browser.

---

## 1. First-time install

```bash
pkg update && pkg upgrade -y
pkg install -y python nodejs-lts git openssh clang libjpeg-turbo which termux-api
python -m ensurepip --upgrade
```

Clone and enter the project:

```bash
git clone <your-fork-url> opendroid && cd opendroid
```

### Backend

```bash
cd backend
pip install --upgrade pip wheel
pip install fastapi uvicorn motor pymongo pydantic python-dotenv httpx
```

`.env` (backend/.env):

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=opendroid
CORS_ORIGINS=*

# Optional LLM providers — sandbox works fully without any of these
LLM_PROVIDER=sim           # sim | ollama | openai | anthropic | groq
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
```

If you don't want Mongo on-device, install `mongodb-community` inside a proot
distro (Ubuntu chroot). MongoDB is only used for a lightweight snapshot every
10s — the hot simulation loop stays in memory.

Start the API on the phone's LAN interface:

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd ../frontend
yarn install
```

Point React at the local backend and start:

```bash
echo "REACT_APP_BACKEND_URL=http://$(hostname -I | awk '{print $1}'):8001" > .env
yarn start
```

Open `http://<phone-ip>:3000` from the Samsung DeX browser.

---

## 2. Troubleshooting CLI

Everything lives under `scripts/`:

```bash
bash scripts/check_status.sh          # ping REST + measure network latency
python scripts/flush_sandbox.py       # wipe simulated sales, keep server up
bash scripts/logs_stream.sh           # color-filtered live tail
```

Environment overrides:

```bash
export OPENDROID_API=http://localhost:8001/api
export OPENDROID_LOG=$PREFIX/var/log/opendroid.log
```

---

## 3. Android process persistence — Background Process Killer

Android is aggressive about killing long-running processes. To keep the
sandbox alive during multi-hour agent runs:

### 3.1 Disable battery optimization

```
Settings → Apps → Termux → Battery → Unrestricted
```

Do the same for the Chrome/Samsung Internet instance that hosts the panel.

### 3.2 Neutralize the Phantom Process Killer (Android 12+)

Enable Developer Options on the phone, plug it into a laptop, then over ADB:

```bash
adb shell "settings put global settings_enable_monitor_phantom_procs false"
adb shell "device_config put activity_manager max_phantom_processes 2147483647"
```

The setting survives reboots on most One UI builds. If it resets after an
update, re-run it — no root required.

### 3.3 Wake lock

Inside Termux, hold a wake lock for the session:

```bash
termux-wake-lock                       # release with termux-wake-unlock
```

---

## 4. Termux-API bridge (production_drivers/)

The `production_drivers/` layer (Graduated Mode) can push native Android
notifications back into DeX every time a real sale or supplier order lands.

Install once:

```bash
pkg install termux-api
```

Test the two hooks used by the driver layer:

```bash
termux-toast -s "Dropdashin: order #A1B2C3 — $39.90"
termux-notification --title "Facebook Marketplace" \
                    --content "Buyer replied on listing #482"
```

Wrap those in the driver — they replace desktop toasts once the sandbox
switches from **SIM** to **GRADUATED** mode.

---

## 5. Boot script

Add this to `~/.termux/boot/00-opendroid.sh` (requires the Termux:Boot
add-on) so the whole stack comes up automatically after a reboot:

```bash
#!/data/data/com.termux/files/usr/bin/env bash
termux-wake-lock
cd $HOME/opendroid/backend
nohup python -m uvicorn server:app --host 0.0.0.0 --port 8001 \
    > $HOME/opendroid/backend.log 2>&1 &
cd $HOME/opendroid/frontend
nohup yarn start > $HOME/opendroid/frontend.log 2>&1 &
```

Make it executable:

```bash
chmod +x ~/.termux/boot/00-opendroid.sh
```

You're done. `bash scripts/check_status.sh` should now come back green from
anywhere on your LAN.
