# 01 — Discord's Electron App Structure

## What is Electron?

**Electron** is a framework for building cross-platform desktop applications using web technologies (HTML, CSS, JavaScript). It bundles:
- **Chromium** — The rendering engine (same as Google Chrome)
- **Node.js** — Server-side JavaScript runtime with native OS access

This means every Electron app is essentially a web application that also has access to the filesystem, OS APIs, and native modules.

---

## Electron Architecture: Two Processes

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │    Main Process     │  │  Renderer Process   │  │
│  │   (Node.js env)     │  │  (Chromium/Browser) │  │
│  │                     │  │                     │  │
│  │  - App lifecycle    │  │  - React/Vue/etc    │  │
│  │  - Native menus     │  │  - DOM/CSS/HTML     │  │
│  │  - File system      │  │  - UI rendering     │  │
│  │  - System tray      │  │  - User interaction │  │
│  │  - IPC handler      │  │  - IPC caller       │  │
│  │  - Native modules   │  │                     │  │
│  └─────────┬───────────┘  └──────────┬──────────┘  │
│            │                         │              │
│            └─────────────────────────┘              │
│                   IPC Bridge                        │
│            (contextBridge / ipcMain)                │
└─────────────────────────────────────────────────────┘
```

### Main Process (`main.js` / `main.ts`)
- Entry point of the Electron app
- Creates `BrowserWindow` instances (the actual windows)
- Has full Node.js access including `fs`, `path`, native modules
- Communicates with renderer via **IPC** (Inter-Process Communication)

### Renderer Process
- Each window is a separate renderer process
- Sandboxed Chromium — limited Node.js access by default
- Runs the React/web UI
- Uses `contextBridge` to safely call main process APIs

### Preload Script
- Runs in renderer with access to both browser APIs and limited Node.js APIs
- Used to expose safe APIs to the renderer via `contextBridge`
- Discord uses this extensively for native integrations

---

## What is an .asar File?

**ASAR** (Atom Shell Archive) is a simple archive format used by Electron to package app files. It's similar to a `.zip` or `.tar` but optimized for Electron's use case:

- Files can be read without full extraction (seeking is supported)
- Improves startup time by reducing filesystem calls
- Does **not** compress files (traded for read performance)
- Can be opened with standard tools

### Discord's ASAR Location

```
C:\Users\marcos.correa\AppData\Local\Discord\app-1.0.9267\resources\app.asar
```

Additional ASAR files you may find:
```
resources/
├── app.asar              ← Main application code
├── app.asar.unpacked/    ← Native modules extracted from asar
│   └── node_modules/
│       ├── @discord/
│       └── ...
└── bootstrap/            ← Discord's auto-updater bootstrap code
```

---

## Extracting the ASAR (Safe Analysis)

> ⚠️ **Legal Note**: Only inspect files from your own installed copy of Discord. Do not redistribute extracted files. This is for personal educational analysis only.

### Install the asar tool

```bash
npm install -g @electron/asar
```

### Extract the archive

```bash
# Create analysis directory
mkdir C:\discord-analysis
cd C:\discord-analysis

# Extract (read-only copy - does not modify original)
asar extract "C:\Users\marcos.correa\AppData\Local\Discord\app-1.0.9267\resources\app.asar" ./extracted

# List contents without extracting
asar list "C:\Users\marcos.correa\AppData\Local\Discord\app-1.0.9267\resources\app.asar" | head -50
```

### Explore the extracted structure

After extraction, you'll typically find:

```
extracted/
├── package.json              ← App manifest (entry point, dependencies)
├── index.js                  ← Main process entry
├── app_bootstrap/            ← Bootstrap/update logic
│   ├── autoUpdater.js
│   ├── splashScreen.js
│   └── ...
├── common/                   ← Shared utilities
├── renderer/                 ← Renderer process code (minified)
│   └── index.js              ← Webpack bundle (massive file)
└── node_modules/             ← npm dependencies
    ├── discord_desktop_core/ ← Core Discord modules
    └── ...
```

---

## Discord's Specific Electron Structure

Discord uses a **multi-layer architecture** in its Electron app:

### Layer 1: Bootstrap / Updater
The outermost layer handles:
- Checking for updates
- Downloading new versions
- Managing module versions
- Showing the splash screen during startup

### Layer 2: Discord Desktop Core
A separate npm module (`discord_desktop_core`) that contains:
- Window management
- Native integrations (overlay, push-to-talk)
- IPC handler registration
- Module loading system

### Layer 3: Webpack-Bundled Web App
The actual React application, bundled into one or a few large JavaScript files:
- Heavily minified and obfuscated
- Implements all UI, state management, WebSocket client, etc.
- Communicates with main process via registered IPC channels

### Discord's Module System

Discord has a custom module system that allows updating individual modules without reinstalling the entire app. Modules are stored at:

```
C:\Users\<user>\AppData\Roaming\discord\<version>\modules\
├── discord_desktop_core-1/
│   └── discord_desktop_core/
├── discord_hook-1/
├── discord_overlay2-1/
├── discord_rpc-1/           ← Rich Presence module
├── discord_spellcheck-1/
└── discord_utils-1/
```

---

## Analyzing the Extracted Code

### Finding the package.json

```bash
cat extracted/package.json
```

Look for:
- `"main"`: Entry point for the main process
- `"version"`: App version
- `"dependencies"`: Native npm modules used

### Reading the Main Process

The main process (`index.js`) sets up:
- `app.on('ready', ...)` — App initialization
- `BrowserWindow` creation with specific options
- IPC handlers: `ipcMain.handle(...)`, `ipcMain.on(...)`
- Native module loading

Example pattern you'll find:
```javascript
// Typical Electron main process structure found in Discord
const { app, BrowserWindow, ipcMain, shell } = require('electron');

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,  // Security: disabled in modern Electron
    }
  });
  
  mainWindow.loadURL('https://discord.com/app');
  // OR for bundled app:
  // mainWindow.loadFile('index.html');
});
```

### Analyzing the Renderer Bundle

The renderer JavaScript bundle is minified. Tools to help analyze it:
- **prettier** / **js-beautify** — Format minified code
- **Chrome DevTools** — Source maps (if present), breakpoints
- **strings** tool — Extract readable strings from the bundle

```bash
# Install js-beautify
npm install -g js-beautify

# Format a minified file (careful — can be very large)
js-beautify extracted/renderer/index.js > renderer-formatted.js

# Search for specific patterns
grep -n "gateway.discord.gg" renderer-formatted.js
grep -n "api/v[0-9]" renderer-formatted.js
grep -n "Authorization" renderer-formatted.js
```

### Useful Strings to Search For

```bash
# API endpoints
grep -o '"https://discord\.com/api/v[0-9][^"]*"' renderer-formatted.js

# WebSocket URLs
grep -o '"wss://[^"]*discord[^"]*"' renderer-formatted.js

# Event names
grep -o '"[A-Z_]{5,}"' renderer-formatted.js | sort | uniq

# Error messages (often not obfuscated)
grep -o '"[A-Z][a-z]* [a-z]* [a-z]*"' renderer-formatted.js
```

---

## IPC Channels in Discord

By analyzing the main process and preload scripts, you can identify IPC channels Discord uses for native features:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `WINDOW_MINIMIZE` | Renderer → Main | Minimize window |
| `WINDOW_MAXIMIZE` | Renderer → Main | Maximize/restore |
| `WINDOW_CLOSE` | Renderer → Main | Close window |
| `SET_BADGE_COUNT` | Renderer → Main | Update taskbar badge |
| `UPDATE_AVAILABLE` | Main → Renderer | Notify of app update |
| `PUSH_TO_TALK` | Main → Renderer | PTT key detected |
| `OVERLAY_RENDER` | Main → Renderer | In-game overlay trigger |
| `OPEN_EXTERNAL` | Renderer → Main | Open URL in browser |

---

## Native Modules

Discord uses several native Node.js modules (`.node` files, compiled C++):

| Module | Purpose |
|--------|---------|
| `discord_voice` | Audio capture, encoding, playback |
| `discord_hook` | In-game overlay injection |
| `discord_rpc` | Rich Presence server (Unix socket / named pipe) |
| `discord_spellcheck` | Native spellchecking |
| `discord_overlay` | GPU compositing for overlay |

These are pre-compiled binaries in `app.asar.unpacked/`.

---

## What Can We Learn from the ASAR?

| Insight | Where Found |
|---------|------------|
| API base URLs | Renderer bundle strings |
| WebSocket gateway URLs | Renderer bundle strings |
| Gateway opcodes | Renderer bundle constants |
| Feature flags | Renderer bundle |
| Error messages | Renderer bundle (often not obfuscated) |
| IPC channels | Main process, preload scripts |
| Native capabilities | package.json, native modules |
| Update mechanism | app_bootstrap directory |
| Module versioning | Module manifest files |

---

## DevTools in the Discord App

Discord ships with Chromium DevTools disabled in production. To re-enable for analysis:

**Method 1: Keyboard shortcut** (sometimes works)
```
Ctrl+Shift+I  (Windows/Linux)
Cmd+Option+I  (macOS)
```

**Method 2: Command line flag**
```bash
"C:\Users\marcos.correa\AppData\Local\Discord\Discord.exe" --remote-debugging-port=9222
```

Then navigate to `chrome://inspect` in a Chrome browser and connect to Discord's renderer process.

**Method 3: settings.json**

Discord reads from `%APPDATA%\discord\settings.json`. You can try adding:
```json
{
  "DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
}
```

---

## Security Considerations

Modern versions of Discord use:
- **`contextIsolation: true`** — Prevents renderer from accessing Node.js directly
- **`nodeIntegration: false`** — Disables Node.js in renderer context  
- **`sandbox: true`** — Full Chromium sandbox for renderer processes
- **CSP headers** — Content Security Policy prevents XSS
- **Code signing** — Binaries are signed to prevent tampering

These are the correct security defaults for production Electron apps, and your clone should implement them too.
