# Roxy

Roxy is a Windows desktop music player built with Electron. It searches the Soulseek network through **slskd**, downloads selected audio files, and plays them locally. It also supports importing playlists from Spotify.

> Roxy is an independent community project. Soulseek, slskd, Spotify, Electron, and their respective trademarks and services belong to their owners.

## Download Roxy

<a href="https://github.com/unfair1k/roxy-soulseek/releases/latest"><img src="https://img.shields.io/badge/Download-Roxy%20for%20Windows-2ea44f?style=for-the-badge&logo=windows" alt="Download Roxy for Windows"></a>

**How to download and install:**

1. Click the **Download Roxy for Windows** button above.
2. On the Releases page, open the latest version.
3. Under **Assets**, download the Windows installer named `Roxy-Setup.exe`.
4. Once the download is complete, double-click the installer and follow the on-screen instructions.
5. Launch **Roxy** from the Desktop shortcut or Start Menu.

You do not need to install Node.js to use the packaged application. If Windows displays a security warning, make sure you downloaded the installer from this official repository before choosing whether to continue.

> If no installer is listed under **Assets**, a Windows installer has not been published yet. Check back after a release is available.

## Features

- Sign in with a Soulseek username and password. If the account does not exist, Soulseek may create it during the first connection.
- Automatically downloads and starts the Windows x64 release of slskd on first use.
- Search Soulseek for music and browse returned files.
- Download a selected result and play it from the local downloads folder.
- Playback queue with play, pause, previous, next, seek, and volume controls.
- Create and manage local playlists.
- Import playlists from Spotify using Spotify's authorization flow.
- Choose a custom background and adjust the glass/transparency appearance.
- Optionally remember the Soulseek login on the device.

## Requirements

### To run the packaged application

- Windows 10 or Windows 11 (64-bit).
- An internet connection for the first slskd download and Soulseek/Spotify services.
- A Soulseek account.
- Windows PowerShell, which is used by the first-run slskd extraction process.

### To run from source or build the installer

- Windows 10 or Windows 11 (64-bit).
- Node.js (LTS recommended), which includes npm.
- An internet connection to install npm dependencies and download Electron.

## Run from source

1. Install Node.js from <https://nodejs.org/>.
2. Clone or download this repository.
3. Open a terminal in the repository root (the folder containing `package.json`).
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start Roxy:

   ```bash
   npm start
   ```

You can also double-click `abrir-roxy.bat` on Windows. The script checks for Node.js, installs dependencies when needed, and launches the app.

## First launch

1. Start Roxy.
2. Enter your Soulseek username and password.
3. Leave **Keep me connected** enabled if you want Roxy to remember the login on this device.
4. On first use, Roxy downloads the latest Windows x64 slskd release from the official slskd GitHub Releases page, extracts it under the user's application data folder, writes the local slskd configuration, and starts the service.
5. Allow Roxy/slskd through Windows Firewall if Windows displays a permission prompt.

Roxy connects to the local slskd web API at `http://localhost:5030`. The API key is generated locally by Roxy and written to the slskd configuration. Soulseek downloads are stored in the slskd downloads directory under the user's local application data folder.

If slskd is already running with a different API configuration, close that instance and restart Roxy.

## Build the Windows installer

From the repository root, run:

```bash
npm install
npm run dist
```

Or double-click `gerar-instalador.bat`.

Electron Builder is configured to create a Windows NSIS installer. The output is written to `dist/`. The installer is configured for per-user installation and creates Start Menu and Desktop shortcuts.

**Build asset note:** the current build configuration references `build/icon.ico` as the Windows installer icon and `build/icon.png` as a packaged resource. Make sure both files exist in the repository before building. If they are missing, add the icon assets to the `build/` directory.

## Spotify playlist import

Roxy can import playlists through Spotify's OAuth Authorization Code with PKCE flow. The app opens Spotify's authorization page in the browser and listens for the local callback at `http://127.0.0.1:8898/callback`. No Spotify client secret is embedded in the app.

Spotify import requires a working Spotify account and network access. It imports playlist track information; Soulseek remains the source used by Roxy to search for and download playable audio files.

## Project structure

```text
roxy-soulseek/
├── main.js                         # Electron main process, settings, slskd and IPC
├── preload.js                      # Secure bridge between renderer and main process
├── package.json                    # Dependencies, scripts and Electron Builder config
├── package-lock.json               # Locked npm dependency versions
├── abrir-roxy.bat                  # Install dependencies if needed and launch Roxy
├── gerar-instalador.bat            # Build the Windows installer
├── README.md
├── build/
│   ├── icon.ico                    # Windows installer icon (required by current config)
│   └── icon.png                    # Packaged app icon resource
└── renderer/
    ├── index.html                  # Main player interface
    ├── styles.css                  # Main interface styling
    ├── app.js                      # Queue, playback UI and playlists
    ├── login.html                  # Soulseek login screen
    ├── login.css
    ├── login.js
    ├── providers/
    │   └── soulseek.js             # Soulseek search, download and audio provider
    ├── background.jpg
    ├── login-photo.jpg
    ├── dance.webp
    └── icon.png
```

## Technologies and upstream projects

- **Electron** — desktop application runtime: <https://www.electronjs.org/>
- **Electron Builder** — Windows installer packaging: <https://www.electron.build/>
- **slskd** — local Soulseek client and Web API. Roxy downloads the official Windows x64 release at first launch: <https://github.com/slskd/slskd>
- **Soulseek** — peer-to-peer music sharing network: <https://www.slsknet.org/>
- **Spotify Web API** — playlist metadata and OAuth authorization: <https://developer.spotify.com/documentation/web-api>

The npm dependencies and exact resolved versions are recorded in `package.json` and `package-lock.json`.

## Customization

- Login screen photo: replace `renderer/login-photo.jpg`.
- Default player background: replace `renderer/background.jpg`. A background can also be selected from inside Roxy.
- Header/player icon: replace `renderer/icon.png`.
- Download animation: replace `renderer/dance.webp`.
- Windows application/installer icons: replace `build/icon.ico` and `build/icon.png`.

Keep the same filenames and paths unless you also update the references in the source and build configuration.

## Troubleshooting

### Roxy cannot connect to Soulseek

- Check your internet connection and Soulseek credentials.
- Make sure Windows Firewall has not blocked Roxy or slskd.
- If another slskd instance is already using port `5030`, close it and restart Roxy.
- If the local slskd configuration was changed manually, check the API key and local API settings.

### The search works but playback does not start

- Wait for the download to finish.
- Check that the download folder exists and has enough free disk space.
- Try another result; the remote user may be offline or the file may be unavailable.
- Roxy supports common audio formats including MP3, FLAC, OGG, OPUS, WAV, M4A, and AAC. Actual playback also depends on the Chromium/Electron media codecs available in the installed build.

### Spotify import does not open or complete

- Check your internet connection and sign in to Spotify in the browser.
- Allow the local callback on `127.0.0.1:8898`.
- If port `8898` is already in use, close the application using it and retry.

### Installer build fails

- Confirm Node.js and npm are installed.
- Run `npm install` again from the repository root.
- Confirm the `build/icon.ico` and `build/icon.png` files exist.
- Check the terminal output for the first reported error.

## Data and privacy

Roxy stores its settings in Electron's per-user application data directory. The app uses Electron's `safeStorage` when available to protect saved credentials and the local slskd API key. If operating-system encryption is unavailable, the current implementation falls back to base64 encoding, which is **not encryption**. Do not use the remember-login option on a shared or untrusted Windows account.

Music files are downloaded from other Soulseek users to the local slskd downloads directory. Spotify authorization is handled through the system browser and the local PKCE callback.

## License

No license file is currently included. Unless a license is added to this repository, all rights to the Roxy source code remain with its copyright holder.