"use strict";

const { ipcRenderer, contextBridge } = require("electron");

// webview -> renderer
const sendWhitelist = new Set()
  .add("initialized")
  .add("printImage")
  .add("reloadGame")
  .add("reportError")
  .add("signupCompleted");

// renderer -> webview
const receiveWhitelist = new Set()
  .add("flashVarsReady")
  .add("removed");

  // allow renderer process to safely communicate with webview process
contextBridge.exposeInMainWorld(
  "ipc", {
    sendToHost: (channel, ...args) => {
      if (sendWhitelist.has(channel)) {
        ipcRenderer.sendToHost(channel, ...args);
      }
    },
    on: (channel, listener) => {
      if (receiveWhitelist.has(channel)) {
        ipcRenderer.on(channel, listener);
      }
    }
  }
);

