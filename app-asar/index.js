"use strict";

const {app, BrowserWindow, clipboard, dialog, ipcMain, shell, globalShortcut, session} = require("electron");
const {autoUpdater} = require("electron-updater");
const crypto = require("crypto");
const path = require("path");
const Store = require("electron-store");
const {machineId} = require("node-machine-id");
const {v4: uuidv4} = require('uuid');
const os = require("os");
const fs = require("fs"); // Use standard fs for sync operations if needed, promises for async
const fsPromises = fs.promises; // Keep promises version available
const config = require("./config.js");
const server = require("./server.js");
const translation = require("./translation.js");

// --- Tester File Paths (Defaults, can be overridden by custom save path) ---
const worksFilePath = path.join(app.getPath('userData'), 'tester_works.txt');
// Note: doesNotWorkFilePath is not used anymore as only 'works' are saved by default.
// --- End Tester File Paths ---

// --- Storage Keys ---
const STORE_KEY_TESTER_LAST_FILE_PATH = 'tester_lastFilePath';
const STORE_KEY_TESTER_SAVE_FILE_PATH = 'tester_saveFilePath';
const STORE_KEY_TESTER_INTER_TEST_DELAY = 'tester_interTestDelay';
const STORE_KEY_TESTER_RETRY_DELAY = 'tester_retryDelay';
const STORE_KEY_TESTER_ACTUAL_LOGIN = 'tester_actualLoginEnabled'; // Added
const STORE_KEY_UUID_SPOOFER = 'uuid_spoofer_enabled'; // Added for UUID spoofing toggle
const STORE_KEY_APP_STATE = 'app_state'; // Added for the main app state object
// --- End Storage Keys ---

const AUTO_UPDATE_STARTUP_DELAY_MS = 2000;
const AUTO_UPDATE_PERIODIC_DELAY_MS = 1 * 60 * 60 * 1000;
const TESTER_PROJECT_URL = "https://github.com/glvckoma/Free-AJC-Account-Tester";

let win = null;

let printWindow = null;

const store = new Store(); // Initialize store (defaults handled by app state logic)

// Variables to hold the latest known state values from the renderer/store
let latestInterTestDelay = store.get(STORE_KEY_TESTER_INTER_TEST_DELAY, 1000); // Load initial value
let latestRetryDelay = store.get(STORE_KEY_TESTER_RETRY_DELAY, 10000); // Load initial value
process.on("uncaughtException", () => {
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

let rcToken = "";
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] == "--rc-token") {
    if (process.argv[++i]) {
      rcToken = crypto.createHash("sha1").update(process.argv[i]).digest("hex");
      break;
    }
  }
}

const pack = require("./package.json");

// clear local save data
if (config.clearStorage) {
  store.clear();
}

let webview = null; // ref to webview within index.html

const loadClient = () => {
  win.loadURL(`file://${__dirname}/gui/index.html`);
};

const updateStatus = {
  state: "idle",
  progress: 0,
};

let autoUpdateTimeoutId = null;

const scheduleAutoUpdate = (delayMs) => {
  if (autoUpdateTimeoutId !== null) {
    clearTimeout(autoUpdateTimeoutId);
  }
  autoUpdateTimeoutId = setTimeout(() => autoUpdater.checkForUpdates(), delayMs);
};

const autoUpdateProgress = (state, progress = null) => {
  updateStatus.state = state;
  updateStatus.progress = progress || null;
  if (win && !win.isDestroyed()) {
      win.webContents.send("autoUpdateStatus", updateStatus);
  }
};

if (!config.noUpdater) {
  scheduleAutoUpdate(AUTO_UPDATE_STARTUP_DELAY_MS);
  autoUpdater.on("error", () => {
    autoUpdateProgress("error");
    scheduleAutoUpdate(AUTO_UPDATE_PERIODIC_DELAY_MS);
  });
  autoUpdater.on("checking-for-update", () => {
    autoUpdateProgress("check");
  });
  autoUpdater.on("update-available", () => {
    autoUpdateProgress("download", 1);
  });
  autoUpdater.on("update-not-available", () => {
    autoUpdateProgress("idle");
    scheduleAutoUpdate(AUTO_UPDATE_PERIODIC_DELAY_MS);
  });
  autoUpdater.on("download-progress", (progress) => {
    autoUpdateProgress("download", progress.percent);
  });
  autoUpdater.on("update-downloaded", () => {
    autoUpdateProgress("restart");
    store.set("app.lastUpdatedAt", new Date().getTime());
  });
}

// communication with renderer
ipcMain.on("loaded", async (event, message) => {
  webview = event.sender;
  const username = store.get("login.username") || "";
  // Default remember me to true
  const rememberMe = store.get("login.rememberMe") !== false;
  const authToken = store.get("login.authToken") || null;
  const refreshToken = store.get("login.refreshToken") || null;
  const df = await getDf();

  webview.send("loginInfoLoaded", {
    username,
    authToken,
    refreshToken,
    rememberMe,
    df,
    config,
    rcToken,
  });

  if (Object.keys(store.store).length === 0) {
    (async () => {
      try {
        const data = await server.listenForAutoLogin();
        if (data) {
          if (data.affiliateCode) {
            store.set("login.affiliateCode", data.affiliateCode);
          }
          if (win && !win.isDestroyed()) {
            win.webContents.send("obtainedToken", {
              token: data.authToken,
            });
          }
        }
      }
      catch {}
    })();
  }
  // TODO: Optimize this, when returning to maximized from full screen it fires of a leave-full-screen event and triggers an extra  disk write with the "windowed" state

  // Maximize event fires after the full screen event
  win.on("enter-full-screen", () => {
    setTimeout(() => {
      // win.webContents.send("log", "fullScreen");
      store.set("window.state", "fullScreen");
      if (webview && !webview.isDestroyed()) webview.send("screenChange", "fullScreen");
    }, 1);
  });

  win.on("maximize", () => {
    // win.webContents.send("log", "maximized");
    store.set("window.state", "maximized");
    if (webview && !webview.isDestroyed()) webview.send("screenChange", "maximized");
  });

  win.on("unmaximize", () => {
    // win.webContents.send("log", "windowed");
    store.set("window.state", "windowed");
    if (webview && !webview.isDestroyed()) webview.send("screenChange", "windowed");
  });

  win.on("leave-full-screen", () => {
    // win.webContents.send("log", "windowed");
    store.set("window.state", "windowed");
    if (webview && !webview.isDestroyed()) webview.send("screenChange", "windowed");
  });

  win.on("close", () => {
    const position = win.getPosition();
    store.set("window.x", position[0]);
    store.set("window.y", position[1]);
  });
});

ipcMain.on("loginSucceeded", (event, message) => {
  server.stop();

  store.set("login.username", message.username);
  store.set("login.language", message.language);
  translation.setLanguage(message.language);
  store.set("login.rememberMe", message.rememberMe);
  if (message.rememberMe) {
    store.set("login.authToken", message.authToken);
    if (message.refreshToken) {
      store.set("login.refreshToken", message.refreshToken);
    }
  }
  else {
    store.delete("login.authToken");
    store.delete("login.refreshToken");
  }

  // Always set the application menu to include Development tools
  // Preserve Jam's original behavior of checking accountType
  if (message.accountType > 2) {
    setApplicationMenu();
  }
});

ipcMain.on("rememberMeStateUpdated", async (event, message) => {
  store.set("login.rememberMe", message.newValue);
});

ipcMain.on("clearAuthToken", async (event, message) => {
  store.delete("login.authToken");
});

ipcMain.on("clearRefreshToken", async (event, message) => {
  store.delete("login.refreshToken");
});

ipcMain.on("about", async (event, message) => {
  if (win) {
    const details = [
      `${translate("version")}: ${pack.version}`,
      `${translate("os")}: ${getOsName()} ${os.arch()} ${os.release()}`,
    ];
    const lastUpdatedAt = store.get("app.lastUpdatedAt");
    if (lastUpdatedAt) {
      details.push(`${translate("lastUpdated")}: ${new Date(lastUpdatedAt).toLocaleString()}`); // Format date
    }
    const username = store.get("login.username");
    if (username) {
      details.push(`${translate("username")}: ${username}`);
    }
    const buttons = [translate("copyDetails"), translate("ok")];
    if (updateStatus.state == "restart") {
      details.push(`\n${translate("restartMessage")}`);
      buttons.unshift(translate("restartButton"));
    }
    else if (updateStatus.state == "error") {
      details.push(`\n${translate("updateError")}`);
      buttons.unshift(translate("websiteButton"));
    }
    const returnValue = await dialog.showMessageBox(win, {
      type: "none",
      icon: path.join(__dirname, 'gui/images/icon.png'), // Use path.join
      title: `${pack.productName}`,
      message: `${pack.productName}`,
      detail: details.join("\n"),
      buttons,
      cancelId: buttons.length - 1,
      defaultId: buttons.length - 1,
    });
    if (updateStatus.state == "restart" && returnValue.response == 0) {
      autoUpdater.quitAndInstall();
    }
    if (updateStatus.state == "error" && returnValue.response == 0) {
      shell.openExternal(config.webClassic);
    }
    else if (returnValue.response == buttons.length - 2) {
      clipboard.writeText(details.join("\n"));
    }
  }
});

const getOsName = () => {
  switch (os.platform()) {
    case "win32": return "Windows";
    case "darwin": return "macOS";
    case "linux": return "Linux";
    default: return "Unknown";
  }
};

const getSystemData = () => {
  const language = store.get("login.language") || app.getLocale().split("-")[0];
  translation.setLanguage(language);
  return {
    version: pack.version,
    platform: os.platform(),
    platformRelease: os.release(),
    language,
    affiliateCode: store.get("login.affiliateCode") || "",
  };
};

const getDf = async () => {
  // Check if UUID spoofing is enabled
  const uuidSpooferEnabled = store.get(STORE_KEY_UUID_SPOOFER, false);

  // If UUID spoofing is enabled, always return a random UUID
  if (uuidSpooferEnabled) {
    return uuidv4();
  }

  // Otherwise, use the stored or machine ID as before
  let df = store.get("login.df");
  if (df === undefined) {
    try {
      df = await machineId({original: true});
    }
    catch (err) {
      df = uuidv4();
    }
    store.set("login.df", df);
  }
  return df;
};

// webview ready
ipcMain.on("ready", () => {
  if (webview && !webview.isDestroyed()) {
    webview.send("postSystemData", getSystemData());
    const screenState = store.get("window.state");
    webview.send("screenChange", screenState);
  }
});
// renderer process ready
ipcMain.on("winReady", () => {
  if (win && !win.isDestroyed()) {
    win.webContents.send("postSystemData", getSystemData());

  }
});

const handleKey = event => {
  const platform = getSystemData().platform;
  // fullscreen
  if (
    (event.key === "Enter" && event.altKey && platform === "win32")
    || (event.key === "F11" && platform === "win32")
    || (event.key === "f" && event.ctrlKey && event.metaKey && platform === "darwin")
  ) {
    if (win) win.setFullScreen(!win.isFullScreen());
  }
  // quit
  else if (
    (event.key === "q" && event.ctrlKey && platform === "win32")
    || (event.key === "F4" && event.altKey && platform === "win32")
    || (event.key === "q" && event.metaKey && platform === "darwin")
  ) {
    app.quit();
  }
};

ipcMain.on("openExternal", (event, message) => {
  // open http/https url in default browser
  try {
    const url = new URL(message.url);
    if (['https:', 'http:'].includes(url.protocol)) {
      shell.openExternal(message.url);
    }
  } catch {}
});

ipcMain.on("openTesterProject", event => {
  if (!win || event.sender !== win.webContents) return;
  shell.openExternal(TESTER_PROJECT_URL);
});

ipcMain.on("keyEvent", (event, message) => handleKey(message));

// UPDATE LOCAL DATA
//  before 0.3.0 full screen was not stored in window.state
if (store.get("window.fullscreen")) {
  store.set("window.state", "fullScreen");
  store.delete("window.fullscreen");
}

// Handle system commands
ipcMain.on("systemCommand", (event, message) => {
  if (message.command === "toggleFullScreen") {
    if (win) win.setFullScreen(!win.isFullScreen());
  }
  else if (message.command === "exit") {
    app.quit();
  }
  else if (message.command === "print") {
    printWindow = new BrowserWindow({
      icon: path.join(__dirname, 'gui/images/icon.png'), // Use path.join
      enableLargerThanScreen: true,
      x: 0,
      y: 0,
      useContentSize: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "gui/printPreload.js"),
        devTools: false,
      },
      fullscreen: false,
      fullscreenable: false,
      backgroundColor: "#FFFFFF",
    });
    // Bug on windows where you cant spawn a window larger than the max monitor size
    // https://github.com/electron/electron/issues/4932
    printWindow.setSize(2480, 3508);
    printWindow.hide();
    printWindow.loadURL(`file://${path.join(__dirname, 'gui/print.html')}`); // Use path.join

    ipcMain.once("readyForImage", event => { // Use once to avoid listener leak
      if (!event.sender.isDestroyed()) {
        event.sender.send("setImage", {
          image: message.image,
          width: message.width,
          height: message.height,
        });
        printWindow.webContents.print({silent: false, printBackground: false, deviceName: ""}, (success, errorType) => {
           // Close window after print attempt regardless of success
           if (printWindow && !printWindow.isDestroyed()) {
               printWindow.close();
           }
        });
      }
    });

    // Ensure printWindow is nulled when closed
    printWindow.on('closed', () => {
        printWindow = null;
        // Remove listeners specific to this print window if necessary
        ipcMain.removeListener("closePrintWindow", closePrintWindowHandler);
    });

    // Define handler separately to allow removal
    const closePrintWindowHandler = () => {
        if (printWindow && !printWindow.isDestroyed()) {
            printWindow.close();
        }
    };
    ipcMain.once("closePrintWindow", closePrintWindowHandler); // Use once
  }
});

// --- Tester File Operations (Async) ---
async function loadAccountsFromFile(filePath) {
  try {
    const data = await fsPromises.readFile(filePath, 'utf8');

    // Split by newline, filter empty lines, trim whitespace
    const lines = data.split(/[\r\n]+/).filter(line => line.trim() !== '');

    // Basic format check (e.g., contains ':') - can be enhanced
    const accounts = lines.map((line, index) => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        return { username: parts[0].trim(), password: parts.slice(1).join(':').trim(), status: 'pending' };
      }
      return null; // Invalid format
    }).filter(account => account !== null); // Remove invalid lines

    return accounts;
  } catch (error) {
    throw error; // Re-throw to be caught by the caller
  }
}

async function saveResultToFile(filePath, accountString) {
  try {
    await fsPromises.appendFile(filePath, accountString + os.EOL, 'utf8');
  } catch (error) {
    // Optionally notify renderer of save error
    if (win && !win.isDestroyed()) {
        win.webContents.send('tester-save-error', { filePath, error: error.message });
    }
  }
}
// --- End Tester File Operations ---


// --- Tester IPC Handlers (Async) ---
ipcMain.on('tester-load-accounts', async (event) => {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Load Account List',
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const accounts = await loadAccountsFromFile(filePath);
      store.set(STORE_KEY_TESTER_LAST_FILE_PATH, filePath); // Save the path
      if (!event.sender.isDestroyed()) event.sender.send('tester-accounts-loaded', { success: true, accounts: accounts, filePath: filePath });
    } else {
      if (!event.sender.isDestroyed()) event.sender.send('tester-accounts-loaded', { success: false, error: 'File selection canceled.' });
    }
  } catch (error) {
    if (!event.sender.isDestroyed()) event.sender.send('tester-accounts-loaded', { success: false, error: error.message });
  }
});

// Handle selecting the save file path for 'works' accounts
ipcMain.on('tester-select-save-path', async (event) => {
  try {
    const result = await dialog.showSaveDialog(win, {
      title: 'Select Save File for Working Accounts',
      defaultPath: path.join(app.getPath('documents'), 'ajc_tester_works.txt'), // Suggest default
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (!result.canceled && result.filePath) {
      if (!event.sender.isDestroyed()) event.sender.send('tester-save-path-result', { success: true, filePath: result.filePath });
    } else {
      // Send cancellation back to renderer
      if (!event.sender.isDestroyed()) event.sender.send('tester-save-path-result', { success: false, canceled: true });
    }
  } catch (error) {
    if (!event.sender.isDestroyed()) event.sender.send('tester-save-path-result', { success: false, error: error.message });
  }
});

// Handle saving the chosen path
ipcMain.on('tester-set-save-path', (event, filePath) => {
  if (filePath && typeof filePath === 'string') {
    store.set(STORE_KEY_TESTER_SAVE_FILE_PATH, filePath);
  } else {
    store.delete(STORE_KEY_TESTER_SAVE_FILE_PATH); // Clear if null/undefined
  }
});

// Handle retrieving the stored path
ipcMain.on('tester-get-save-path', (event) => {
  const savePath = store.get(STORE_KEY_TESTER_SAVE_FILE_PATH);
  // Send path back immediately if found (even if null)
  if (!event.sender.isDestroyed()) event.sender.send('tester-save-path-result', { success: true, filePath: savePath });
});


ipcMain.on('tester-save-works', (event, accountString) => {
  const customSavePath = store.get(STORE_KEY_TESTER_SAVE_FILE_PATH);
  const finalPath = customSavePath || worksFilePath; // Use custom path if set, else default
  saveResultToFile(finalPath, accountString); // Already async
});

ipcMain.on('tester-get-last-path', (event) => {
  const lastPath = store.get(STORE_KEY_TESTER_LAST_FILE_PATH);
  if (!event.sender.isDestroyed()) event.sender.send('tester-last-path-result', lastPath);
});

ipcMain.on('tester-set-last-path', (event, filePath) => {
  if (filePath && typeof filePath === 'string') {
    store.set(STORE_KEY_TESTER_LAST_FILE_PATH, filePath);
  }
});

// Handle saving delay settings
ipcMain.on('tester-set-delay', (event, { key, value }) => {
  if ((key === 'interTestDelay' || key === 'retryDelay') && typeof value === 'number' && value >= 0) {
    let storeKey;
    // Update the latest known value in the main process
    if (key === 'interTestDelay') {
      latestInterTestDelay = value;
      storeKey = STORE_KEY_TESTER_INTER_TEST_DELAY;
    } else if (key === 'retryDelay') {
      latestRetryDelay = value;
      storeKey = STORE_KEY_TESTER_RETRY_DELAY;
    }

    store.set(storeKey, value);
  }
});

// Handle retrieving delay settings
ipcMain.on('tester-get-delays', (event) => {
  const interTestDelay = store.get(STORE_KEY_TESTER_INTER_TEST_DELAY, 1000); // Default 1000ms
  const retryDelay = store.get(STORE_KEY_TESTER_RETRY_DELAY, 10000); // Default 10000ms
  if (!event.sender.isDestroyed()) event.sender.send('tester-delays-loaded', { interTestDelay, retryDelay });
});

// Handle loading a specific file path (for auto-load on startup) - WITH RETRIES
ipcMain.on('tester-load-specific-file', async (event, filePath) => {
  const sender = event.sender; // Store sender for safety

  if (!filePath || typeof filePath !== 'string') {
    if (!sender.isDestroyed()) sender.send('tester-specific-file-loaded', { success: false, error: 'Invalid file path provided.' });
    return;
  }

  const maxRetries = 3;
  const retryDelayMs = 500; // ms
  let lastError = null;


  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fsPromises.access(filePath, fs.constants.R_OK); // Check read access
      const accounts = await loadAccountsFromFile(filePath);

      if (sender.isDestroyed()) {
        return;
      }
      const response = { success: true, accounts: accounts, filePath: filePath };
      sender.send('tester-specific-file-loaded', response);
      return; // Exit after successful load

    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // All retries failed - send error to renderer
  let userMessage = lastError.message; // Default to the last error message
  if (lastError.code === 'ENOENT') {
    userMessage = `File not found: ${filePath}`;
  } else if (lastError.code === 'EACCES') {
    userMessage = `Permission denied reading file: ${filePath}`;
  }

  if (!sender.isDestroyed()) {
      sender.send('tester-specific-file-loaded', { success: false, error: userMessage, filePath: filePath });
  }
});

// Handle reloading the current list from its source file
ipcMain.on('tester-reload-list-request', async (event) => {
  const lastFilePath = store.get(STORE_KEY_TESTER_LAST_FILE_PATH);
  if (!lastFilePath || typeof lastFilePath !== 'string') {
    if (!event.sender.isDestroyed()) event.sender.send('tester-reload-list-result', { success: false, error: 'No file path known for reload.' });
    return;
  }
  try {
    await fsPromises.access(lastFilePath, fs.constants.R_OK); // Check read access
    const accounts = await loadAccountsFromFile(lastFilePath);
    if (!event.sender.isDestroyed()) event.sender.send('tester-reload-list-result', { success: true, accounts: accounts, filePath: lastFilePath });
  } catch (error) {
     let userMessage = error.message;
     if (error.code === 'ENOENT') {
         userMessage = `File not found: ${lastFilePath}`;
     } else if (error.code === 'EACCES') {
         userMessage = `Permission denied reading file: ${lastFilePath}`;
     }
    if (!event.sender.isDestroyed()) event.sender.send('tester-reload-list-result', { success: false, error: userMessage, filePath: lastFilePath });
  }
});

// Handle setting actual login mode state
ipcMain.on('tester-set-actual-login-mode', (event, isEnabled) => {
  store.set(STORE_KEY_TESTER_ACTUAL_LOGIN, !!isEnabled); // Ensure boolean
});

// Handle retrieving actual login mode state
ipcMain.on('tester-get-actual-login-mode', (event) => {
  const isEnabled = store.get(STORE_KEY_TESTER_ACTUAL_LOGIN, false); // Default to false
  if (!event.sender.isDestroyed()) event.sender.send('tester-actual-login-mode-loaded', isEnabled);
});

// Handle setting UUID spoofer state
ipcMain.on('tester-set-uuid-spoofer', (event, isEnabled) => {
  store.set(STORE_KEY_UUID_SPOOFER, !!isEnabled); // Ensure boolean
});

// Handle retrieving UUID spoofer state
ipcMain.on('tester-get-uuid-spoofer', (event) => {
  const isEnabled = store.get(STORE_KEY_UUID_SPOOFER, false); // Default to false
  if (!event.sender.isDestroyed()) event.sender.send('tester-uuid-spoofer-loaded', isEnabled);
});

// Handle cleanup of processed accounts from file
ipcMain.handle('tester-cleanup-processed', async (event, filePath) => {
  if (!filePath) {
    return { success: false, error: 'File path is required.' };
  }

  try {
    // 1. Get current state from the appState variable
    const fileState = appState?.accountTester?.fileStates?.[filePath];

    if (!fileState) {
      return { success: true, removedCount: 0, message: 'No state found for this file.' };
    }

    // 2. Read the account file content asynchronously
    let fileContent;
    try {
      fileContent = await fsPromises.readFile(filePath, 'utf-8');
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        return { success: false, error: `Account file not found: ${filePath}` };
      }
      throw readError; // Re-throw other read errors
    }

    const lines = fileContent.split(/\r?\n/);
    let originalCount = 0;
    const linesToKeep = [];

    // 3. Filter lines based on state
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue; // Skip empty lines

      originalCount++;
      // Assume line is "user:pass" which is the key in state
      // Handle potential variations if needed
      const accountKey = trimmedLine;
      const status = fileState[accountKey];

      // Keep lines that are pending, testing, or not found in state
      if (!status || status === 'pending' || status === 'testing') {
        linesToKeep.push(line); // Keep the original line ending
      }
    }

    const removedCount = originalCount - linesToKeep.length;

    // 4. Write the filtered content back to the file asynchronously
    await fsPromises.writeFile(filePath, linesToKeep.join(os.EOL), 'utf-8'); // Use OS-specific EOL

    // 5. Clean up the state to match the file contents
    const newFileState = {};
    for (const line of linesToKeep) {
      const trimmedLine = line.trim();
      if (trimmedLine && trimmedLine.includes(':')) { // Ensure it's a valid account line
        // If the account was in the original state, preserve its status (pending/testing)
        // Otherwise, it will be undefined (implicitly pending)
        newFileState[trimmedLine] = fileState[trimmedLine] === 'testing' ? 'testing' : 'pending';
      }
    }

    // Update the app state with the new file state
    if (appState.accountTester.fileStates) {
        appState.accountTester.fileStates[filePath] = newFileState;
    }
    // Also clear scroll and filter for the cleaned file? Optional.
    // if (appState.accountTester.scrollIndex) delete appState.accountTester.scrollIndex[filePath];
    // if (appState.accountTester.filterQuery) delete appState.accountTester.filterQuery[filePath];

    // Save the updated state
    await saveAppState();

    return { success: true, removedCount: removedCount };

  } catch (error) {
    return { success: false, error: error.message || 'An unknown error occurred during cleanup.' };
  }
});
// --- End Tester IPC Handlers ---

// --- App State Management ---
// Create a default app state structure
const DEFAULT_APP_STATE = {
  accountTester: {
    currentFile: null,
    scrollIndex: {},  // Map of file paths to scroll positions
    filterQuery: {},  // Map of file paths to filter queries
    fileStates: {}    // Map of file paths to account states { "user:pass": "status" }
  }
};

// In-memory app state (will be persisted to store)
let appState = { ...DEFAULT_APP_STATE };

// Initialize app state from store
function initializeAppState() {
  try {
    // Load from store if exists
    const storedState = store.get(STORE_KEY_APP_STATE);
    if (storedState && typeof storedState === 'object') {
      // Deep merge with default state to ensure all properties exist and handle potential structure changes
      appState = {
        ...DEFAULT_APP_STATE,
        ...storedState,
        accountTester: {
          ...DEFAULT_APP_STATE.accountTester,
          ...(storedState.accountTester || {}),
          fileStates: {
            // Ensure fileStates is always an object
            ...(typeof storedState.accountTester?.fileStates === 'object' ? storedState.accountTester.fileStates : {})
          },
          scrollIndex: {
            ...(typeof storedState.accountTester?.scrollIndex === 'object' ? storedState.accountTester.scrollIndex : {})
          },
          filterQuery: {
            ...(typeof storedState.accountTester?.filterQuery === 'object' ? storedState.accountTester.filterQuery : {})
          }
        }
      };
    } else {
      appState = JSON.parse(JSON.stringify(DEFAULT_APP_STATE)); // Deep copy default
    }
  } catch (error) {
    appState = JSON.parse(JSON.stringify(DEFAULT_APP_STATE)); // Deep copy default on error
  }
  // Ensure accountTester exists
  if (!appState.accountTester) {
      appState.accountTester = JSON.parse(JSON.stringify(DEFAULT_APP_STATE.accountTester));
  }
  // Ensure nested properties exist
  if (!appState.accountTester.fileStates) appState.accountTester.fileStates = {};
  if (!appState.accountTester.scrollIndex) appState.accountTester.scrollIndex = {};
  if (!appState.accountTester.filterQuery) appState.accountTester.filterQuery = {};

}

// Save app state to store
async function saveAppState() {
  // Basic validation before saving
  if (!appState || typeof appState !== 'object' || !appState.accountTester) {
      return false;
  }
  try {
    store.set(STORE_KEY_APP_STATE, appState);
    return true;
  } catch (error) {
    return false;
  }
}

// IPC handlers for app state
ipcMain.handle('get-app-state', async () => {
  // Return a deep copy to prevent accidental modification of the main process state
  return JSON.parse(JSON.stringify(appState));
});

ipcMain.handle('set-app-state', async (event, newState) => {
  if (!newState || typeof newState !== 'object') {
    return { success: false, error: 'Invalid state object' };
  }

  try {
    // Deep merge the new state into the existing state
    // This preserves parts of the state not included in newState
    appState = {
      ...appState, // Keep existing top-level keys
      ...newState, // Overwrite/add top-level keys from newState
      accountTester: { // Deep merge accountTester specifically
        ...appState.accountTester, // Keep existing tester keys
        ...(newState.accountTester || {}), // Overwrite/add tester keys from newState
        // Ensure nested objects are also merged, not just replaced
        fileStates: {
          ...(appState.accountTester?.fileStates || {}),
          ...(newState.accountTester?.fileStates || {})
        },
        scrollIndex: {
          ...(appState.accountTester?.scrollIndex || {}),
          ...(newState.accountTester?.scrollIndex || {})
        },
        filterQuery: {
          ...(appState.accountTester?.filterQuery || {}),
          ...(newState.accountTester?.filterQuery || {})
        }
      }
    };

    // Ensure critical nested structures exist after merge
    if (!appState.accountTester) appState.accountTester = JSON.parse(JSON.stringify(DEFAULT_APP_STATE.accountTester));
    if (!appState.accountTester.fileStates) appState.accountTester.fileStates = {};
    if (!appState.accountTester.scrollIndex) appState.accountTester.scrollIndex = {};
    if (!appState.accountTester.filterQuery) appState.accountTester.filterQuery = {};


    // Save to store
    const saved = await saveAppState();
    if (saved) {
        return { success: true };
    } else {
        return { success: false, error: 'Failed to save updated state.' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});
// --- End App State Management ---

// --- IPC Handler for Setting Session User Agent ---
ipcMain.handle('set-user-agent', async (event, userAgent) => {
  if (userAgent && typeof userAgent === 'string') {
    try {
      // Use defaultSession
      await session.defaultSession.setUserAgent(userAgent);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    return { success: false, error: 'Invalid User-Agent string provided.' };
  }
});
// --- End IPC Handler for Setting Session User Agent ---

const translate = (phrase) => {
  const {value} = translation.translate(phrase);
  return value;
};

ipcMain.on("translate", (event, message) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send("translate", {
      phrase: message.phrase,
      requestId: message.requestId,
      value: translate(message.phrase),
    });
  }
});

// add flash plugin
try {
    const flashPath = path.join(__dirname, `${config.pluginPath}${config.pluginName}`);
    // Check if flash plugin exists before appending switch
    if (fs.existsSync(flashPath)) {
        app.commandLine.appendSwitch("ppapi-flash-path", flashPath);
    }
} catch {}


app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true); // Allow the invalid certificate (Use with caution!)
});

app.whenReady().then(() => {

  // Initialize app state (loads from store or uses defaults)
  initializeAppState();

  // --- Ensure default tester settings exist in store (redundant if using appState init, but safe) ---
  if (!store.has(STORE_KEY_TESTER_INTER_TEST_DELAY)) store.set(STORE_KEY_TESTER_INTER_TEST_DELAY, 1000);
  if (!store.has(STORE_KEY_TESTER_RETRY_DELAY)) store.set(STORE_KEY_TESTER_RETRY_DELAY, 10000);
  if (!store.has(STORE_KEY_TESTER_ACTUAL_LOGIN)) store.set(STORE_KEY_TESTER_ACTUAL_LOGIN, false);
  if (!store.has(STORE_KEY_UUID_SPOOFER)) store.set(STORE_KEY_UUID_SPOOFER, false);
  // --- End Ensure Defaults ---

  // --- Register Global Shortcuts ---
  function registerTesterShortcuts() {
    try {
        globalShortcut.register('CommandOrControl+Shift+Y', () => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('tester-trigger-works');
          }
        });

        globalShortcut.register('CommandOrControl+Shift+N', () => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('tester-trigger-does-not-work');
          }
        });
    } catch {}
  }
  // --- End Register Global Shortcuts ---


  const minWidth = 800; // Reduced from 900 in Jam version, keep reduced
  const minHeight = 500; // Reduced from 550 in Jam version, keep reduced

  // Create the browser window.
  win = new BrowserWindow({
    icon: path.join(__dirname, 'gui/images/icon.png'), // Use path.join
    minWidth,
    minHeight,
    // 160% min size (comment seems outdated, using stored/default size)
    width: store.get("window.width") || 1440, // Default size if not stored
    height: store.get("window.height") || 880,
    x: store.get("window.x"), // Let Electron handle default position if not stored
    y: store.get("window.y"),
    useContentSize: true,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      webviewTag: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "gui/preload.js"),
      plugins: true, // Required for Flash
      devTools: false,
    },
    autoHideMenuBar: true, // Keep menu hidden
    fullscreen: store.get("window.state") === "fullScreen",
    fullscreenable: true,
    backgroundColor: "#F5C86D", // Original background color
  });
  win.setMenu(null); // Ensure menu is explicitly null

  const winState = store.get("window.state");
  if (winState === "fullScreen") {
    win.setFullScreen(true);
  }
  else if (winState === "maximized") {
    win.maximize();
  }

  if (config.clearCache) {
    win.webContents.session.clearCache().catch(() => {});
  }

  loadClient();

  win.on("closed", () => {
    win = null; // Dereference the window object
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
  });

  win.on("resize", () => {
    // Only save size if not maximized or fullscreen
    if (!win.isMaximized() && !win.isFullScreen()) {
        const bounds = win.getBounds();
        store.set("window.width", bounds.width);
        store.set("window.height", bounds.height);
    }
  });

  // Register shortcuts after window is ready
  registerTesterShortcuts();

});

app.on("window-all-closed", () => {
  app.quit();
});

// Unregister shortcuts and attempt final save before quitting
app.on('will-quit', async () => { // Make async to await saveAppState

  // Attempt to save the final app state
  await saveAppState(); // Await the save operation

  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
});
