# MaxPad App

Desktop companion app for the **MaxPad** (CircuitPython + KMK) macro pad.

This app helps:
- Detect the MaxPad/CIRCUITPY drive (with an optional drive-letter hint on Windows)
- Edit and save `maxpad_config.json` (profiles/layers, 12 keys + 3 encoder actions)
- (Optionally) initialize/update the board files (`boot.py` and `code.py`) with a known-good KMK + OLED + telemetry setup
- View live device telemetry (OLED text, pressed keys, active profile) over serial

Related firmware / board files repo: https://github.com/Sukarth/MaxPad

## Prerequisites

- Node.js (LTS recommended)
- npm
- Windows/macOS/Linux

## Install

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

## Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Using with a MaxPad

1. Plug in the MaxPad and make sure it appears as a drive (usually `CIRCUITPY`).
2. In the app, click the device scan/connect flow.
	- On Windows, if auto-detect fails, try providing a drive hint like `D:` or `D:\`.
3. Edit your profiles and click “Save to MaxPad”.
	- If you enable initialization, the app writes `boot.py` and `code.py` too.

## Development notes

- Main process IPC lives in `src/main/` (drive scanning + file writes, telemetry).
- UI lives in `src/renderer/`.
- This project uses electron-vite.
