"use strict";

// --- Tester Bridge Script ---
// This script loads *before* LoginScreen.js and defines placeholder functions
// globally. The actual ES modules will load later and register their
// implementations with this bridge.

(function() {

    let _realInitTesterUI = null;
    let _realSetupTesterIPCListeners = null;
    // Remove variables for UI functions no longer handled by bridge listener
    // let _realRenderTesterAccountList = null;
    // let _realUpdateTesterSummary = null;
    let _shadowRootForUI = null;
    let _ipcListenersSetupCalled = false;

    // Placeholder for UI initialization
    window.initTesterUI = function(shadowRoot) {
        _shadowRootForUI = shadowRoot; // Store shadowRoot for later
        if (_realInitTesterUI) {
            _realInitTesterUI(shadowRoot);
        }
    };

    // Placeholder for IPC listener setup
    window.setupTesterIPCListeners = function() {
        _ipcListenersSetupCalled = true; // Mark that setup was requested
        if (_realSetupTesterIPCListeners) {
            _realSetupTesterIPCListeners();
        }
    };

    // Registration function for the real UI initializer
    window.registerInitTesterUI = function(realFunction) {
        _realInitTesterUI = realFunction;
        // If initTesterUI was already called with a shadowRoot, call the real one now
        if (_shadowRootForUI) {
            _realInitTesterUI(_shadowRootForUI);
        }
    };

    // REMOVE Placeholder for List Render function
    // window.renderTesterAccountList = function(forceFullRender = false) { ... };

    // REMOVE Placeholder for Summary Update function
    // window.updateTesterSummary = function() { ... };

    // Registration function for the real UI initializer
    window.registerSetupTesterIPCListeners = function(realFunction) {
        _realSetupTesterIPCListeners = realFunction;
        // If setupTesterIPCListeners was already called, call the real one now
        if (_ipcListenersSetupCalled) {
            _realSetupTesterIPCListeners();
        }
    };

    // REMOVE Registration function for the real List Render function
    // window.registerRenderTesterAccountList = function(realFunction) { ... };

     // REMOVE Registration function for the real Summary Update function
    // window.registerUpdateTesterSummary = function(realFunction) { ... };

    // REMOVE loginSucceeded Listener - No longer needed in bridge
    // if (window.ipc) { ... }
    // --- End loginSucceeded Listener ---

    // Placeholder for tester status update function
    window.updateTesterAccountStatus = () => {};
    window.registerUpdateTesterAccountStatus = (fn) => { window.updateTesterAccountStatus = fn; };

})();
