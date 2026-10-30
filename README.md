# Roxy

**Roxy** is a Windows desktop music player built with Electron and integrated with the Soulseek network. Sign in with your Soulseek account, search for audio files shared by other users, download tracks, and play your music directly in Roxy.

> Roxy does not host music or provide its own music catalog. Searches and transfers use the Soulseek network through the slskd service, which Roxy is designed to set up automatically on first launch.

## Features

- Soulseek account login through the app's welcome screen.
- **Keep me signed in** option for easier future access.
- Automatic setup and startup of the slskd service on first launch.
- Search for audio files shared across the Soulseek network.
- Browse search results and start downloads from the player.
- Play downloaded files locally once they are available.
- Custom interface with transparency, background artwork, and Roxy branding.
- Built-in playback controls and a dedicated login screen.

Search results and download speeds depend on other Soulseek users and their network connections.

## Requirements

- Windows 10 or Windows 11 (64-bit).
- Node.js and npm (required to run from source or build the installer).
- An internet connection.
- A Soulseek account.

You do not need to manually install or configure slskd. Roxy is designed to prepare and start the required service during its first launch.

## Run Roxy from source

1. Download the repository using **Code → Download ZIP**, then extract it.
2. Open the extracted project folder containing `package.json`.
3. Install Node.js if it is not already installed: https://nodejs.org/
4. Double-click `abrir-roxy.bat`.

The batch file checks for Node.js, installs project dependencies when needed, and launches the app.

You can also run Roxy from a terminal opened in the project folder:

```powershell
npm install
npm start
```

On the first launch, give Roxy time to prepare the service required to connect to Soulseek. If Windows Firewall asks for permission, allow access so the connection can work properly.

## Getting started

1. Launch Roxy.
2. On the login screen, enter your Soulseek username and password.
3. Enable **Keep me signed in** if you want Roxy to remember your login on this computer.
4. Wait for the service to start and the connection to be established.
5. Open the search area and search for a track.
6. Select a result to start downloading it. Once the file is available locally, you can play it in Roxy.

Use **Log out** to end the saved session and return to the login screen.

## Build the Windows installer

1. Install Node.js.
2. Open the Roxy project folder.
3. Double-click `gerar-instalador.bat`.

Or run the following commands in a terminal:

```powershell
npm install
npm run dist
```

Electron Builder creates the installer in the `dist/` directory. The installer filename follows the `Roxy Setup x.x.x.exe` format. The current build configuration creates Start Menu and Desktop shortcuts.

## Project structure

```text
roxy/
├── main.js
├── preload.js
├── package.json
├── abrir-roxy.bat
├── gerar-instalador.bat
├── build/
│   ├── icon.ico
│   └── icon.png
└── renderer/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── login.html
    ├── login.css
    ├── login.js
    ├── background.jpg
    ├── login-photo.jpg
    ├── dance.webp
    ├── icon.png
    └── providers/
        └── soulseek.js
```

### Key files

- `main.js`: Electron main process. Manages the application window, system integration, and communication with the Soulseek/slskd service.
- `preload.js`: Exposes the required, limited set of main-process functions to the player.
- `renderer/index.html`, `app.js`, and `styles.css`: Main player interface, application behavior, and visual styling.
- `renderer/login.html`, `login.js`, and `login.css`: Login screen and its behavior and styling.
- `renderer/providers/soulseek.js`: Soulseek integration used to search, monitor transfers, and work with downloaded files.
- `renderer/background.jpg`: Main player background image.
- `renderer/login-photo.jpg`: Login screen artwork.
- `renderer/dance.webp`: Animation used during loading or transfers.
- `renderer/icon.png`, `build/icon.png`, and `build/icon.ico`: Interface and application/installer icons.
- `abrir-roxy.bat`: Installs dependencies when needed and starts Roxy.
- `gerar-instalador.bat`: Prepares the environment and builds the Windows installer.

## Customization

You can replace the artwork while keeping the same filenames and formats:

- Player background: `renderer/background.jpg`.
- Login screen image: `renderer/login-photo.jpg`.
- Animation: `renderer/dance.webp`.
- Icon displayed in the interface: `renderer/icon.png`.
- Executable and installer icons: `build/icon.ico` and `build/icon.png`.

To change colors, transparency, spacing, and other visual details, edit `renderer/styles.css`. To change player behavior, review `renderer/app.js` and the integration in `renderer/providers/soulseek.js`.

## Technology and service overview

- **Soulseek**: A peer-to-peer network used by its users to find and transfer shared files.
- **slskd**: A client/service that connects to Soulseek and provides a local API used by Roxy. Roxy automates its setup so users do not have to configure it manually.
- **Electron**: A framework for building desktop applications with JavaScript, HTML, and CSS.
- **electron-builder**: A tool used to package Roxy as a Windows installer.

Official projects:
- Soulseek: https://www.slsknet.org/
- slskd: https://github.com/slskd/slskd
- Electron: https://www.electronjs.org/
- electron-builder: https://www.electron.build/

## Troubleshooting

- **The npm command is not recognized:** Install Node.js and open a new terminal window.
- **Roxy does not start:** Run `npm install` in the folder containing `package.json`, then try `npm start` again.
- **Login or connection fails:** Check your Soulseek username and password. Also make sure Windows Firewall is not blocking Roxy or its supporting service.
- **Search returns no results:** Try a different search term and check your internet connection and Soulseek connection status.
- **A download does not start or gets stuck:** Transfers depend on the other user being online, allowing the transfer, and having the file available.

## Responsible use

Soulseek is a user-to-user file-sharing network. Roxy is a client interface and does not verify the copyright status of files found through the network. Only download, share, and play content you are authorized to use, and follow applicable laws and service terms.

Roxy is an independent project and is not officially affiliated with Soulseek or slskd.
