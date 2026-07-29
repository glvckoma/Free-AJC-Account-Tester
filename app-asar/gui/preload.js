"use strict";

const { ipcRenderer, contextBridge } = require("electron");
const { v4: uuidv4 } = require('uuid'); // Import uuid v4

// renderer -> main
const sendWhitelist = new Set()
  .add("about")
  .add("clearAuthToken")
  .add("clearRefreshToken")
  .add("keyEvent")
  .add("loaded")
  .add("loginSucceeded")
  .add("openExternal")
  .add("openTesterProject")
  .add("ready")
  .add("rememberMeStateUpdated")
  .add("systemCommand")
  .add("translate")
  // Tester Send Channels
  .add("tester-load-accounts")
  .add("tester-reload-list-request")
  .add("tester-select-save-path")
  .add("tester-set-delay")
  .add("tester-set-actual-login-mode")
  .add("tester-get-last-path")
  .add("tester-get-save-path")
  .add("tester-get-delays")
  .add("tester-get-actual-login-mode")
  .add("tester-save-works")
  .add("tester-load-specific-file")
  // Added from Jam version
  .add("tester-set-last-path")
  .add("tester-set-save-path")
  .add("tester-set-uuid-spoofer")
  .add("tester-get-uuid-spoofer");

// main -> renderer
const receiveWhitelist = new Set()
  .add("autoUpdateStatus")
  .add("loginInfoLoaded")
  .add("postSystemData")
  .add("obtainedToken")
  .add("screenChange")
  .add("translate")
  // Tester Receive Channels
  .add("tester-accounts-loaded")
  .add("tester-reload-list-result")
  .add("tester-save-path-result")
  .add("tester-last-path-result")
  .add("tester-specific-file-loaded")
  .add("tester-delays-loaded")
  .add("tester-actual-login-mode-loaded")
  .add("tester-trigger-works")
  .add("tester-trigger-does-not-work")
  .add("tester-auto-load-result")
  // Added from Jam version
  .add("tester-uuid-spoofer-loaded")
  .add("tester-save-error"); // Added for reporting save errors

// Renderer -> Main (Invoke/Handle)
// Renderer -> Main (Invoke/Handle) - Merged sendWhitelist and invokeWhitelist for clarity
const invokeWhitelist = new Set()
  .add("get-app-state")
  .add("set-app-state")
  .add("tester-cleanup-processed")
  .add("set-user-agent"); // Added for setting user agent

// allow renderer process to safely communicate with main process
contextBridge.exposeInMainWorld(
  "ipc", {
    send: (channel, ...args) => {
      if (sendWhitelist.has(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel, listener) => {
      if (receiveWhitelist.has(channel)) {
        ipcRenderer.on(channel, listener);
      }
    },
    off: (channel, listener) => { // ADDED off method
      if (receiveWhitelist.has(channel)) {
        ipcRenderer.removeListener(channel, listener);
      }
    },
    invoke: (channel, ...args) => { // Make invoke consistent with send/on
      if (invokeWhitelist.has(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      // Reject promise for unwhitelisted channels
      return Promise.reject(new Error(`Invoke to channel '${channel}' is not allowed.`));
    },
    // --- Expose UUID ---
    uuidv4: () => uuidv4() // Expose the uuidv4 function
  }
);

