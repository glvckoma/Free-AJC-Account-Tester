// IPC communication handlers specific to the Account Tester
"use strict";

import { testerState } from './tester-state.js';
import { processCurrentAccount } from './tester-logic.js';
// Import ALL necessary UI functions
import {
    renderTesterAccountList,
    updateTesterButtons,
    updateTesterSummary,
    setTesterMessage,
    // updateSavePathDisplay, // Removed import
    updateDelayInputs,
    updateToggleStates
} from './tester-ui.js';

// Helper function to load and apply saved state for a file
async function loadAndApplySavedState(filePath) {
    try {
        const appState = await window.ipc.invoke('get-app-state');
        const currentTesterState = appState?.accountTester || {};
        const fileState = currentTesterState.fileStates?.[filePath];
        if (fileState) {
            testerState.accounts.forEach(acc => {
                const accountKey = `${acc.username}:${acc.password}`;
                if (fileState[accountKey]) {
                    acc.status = fileState[accountKey];
                } else {
                    acc.status = 'pending';
                }
            });
        } else {
            testerState.accounts.forEach(acc => acc.status = 'pending');
        }

        return true;
    } catch (err) {
        setTesterMessage('Error loading saved state.');
        testerState.accounts.forEach(acc => acc.status = 'pending');
        return false;
    }
}

function setupTesterIPCListeners() {

    // --- State Loading & Updates ---
    window.ipc.on("tester-accounts-loaded", async (event, data) => {
        if (data && data.success) {
            testerState.accounts = data.accounts || [];
            testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1;
            testerState.lastFilePath = data.filePath;
            setTesterMessage(''); // Clear message initially

            // Load state *after* loading accounts from file
            await loadAndApplySavedState(testerState.lastFilePath);

            // Defer the UI updates slightly to allow layout calculation
            setTimeout(() => {
                // First render to get elements in DOM
                renderTesterAccountList(true); // Call UI function

                // Then use requestAnimationFrame for a second render after layout
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Final render with correct measurements
                        renderTesterAccountList(true);
                        updateTesterButtons(); // Call UI function
                        updateTesterSummary(); // Call UI function
                    });
                });

            }, 0); // 0ms timeout defers execution until after current stack clears


        } else {
            window.alert(`Error loading accounts file: ${data?.error || 'Unknown error'}`); // Keep alert for user feedback
        }
    });
    // REMOVED loginSucceeded listener - Moved to tester-bridge.js


    // Listeners for shortcut triggers
    window.ipc.on('tester-trigger-works', () => {
        processCurrentAccount('works'); // Call logic function
    });

    window.ipc.on('tester-trigger-does-not-work', () => {
        processCurrentAccount('invalid'); // Call logic function
    });

    // --- REMOVED 'tester-save-path-result' listener ---

    // Listener for last path result (for initial loading)
    window.ipc.on("tester-last-path-result", (event, lastPath) => {
        if (lastPath) {
            testerState.lastFilePath = lastPath; // Update state
            window.ipc.send('tester-load-specific-file', lastPath);
        }
    });

    // Listener for the result of the auto-load attempt
    window.ipc.on('tester-specific-file-loaded', async (event, data) => {
        if (data && data.success) {
            testerState.accounts = data.accounts || []; // Update state
            testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1; // Update state
            testerState.lastFilePath = data.filePath; // Update state

            // Load and apply saved state before UI updates
            await loadAndApplySavedState(data.filePath);

            // Defer the UI updates slightly to allow layout calculation
            setTimeout(() => {
                // First render to get elements in DOM
                renderTesterAccountList(true); // Call UI function

                // Then use requestAnimationFrame for a second render after layout
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Final render with correct measurements
                        renderTesterAccountList(true);
                        updateTesterButtons(); // Call UI function
                        updateTesterSummary(); // Call UI function
                        setTesterMessage(`Auto-loaded ${testerState.accounts.length} accounts from ${data.filePath.split(/[\\/]/).pop()}.`); // Call UI function
                    });
                });

            }, 0); // 0ms timeout defers execution until after current stack clears

        } else {
            setTesterMessage(`Error auto-loading last file: ${data.error}`); // Call UI function
        }
    });

    // Listener for loaded delays
    window.ipc.on('tester-delays-loaded', (event, delays) => {
        if (typeof delays.interTestDelay === 'number' && delays.interTestDelay >= 0) {
            testerState.interTestDelay = delays.interTestDelay; // Update state
        }
        if (typeof delays.retryDelay === 'number' && delays.retryDelay >= 0) {
            testerState.retryDelay = delays.retryDelay; // Update state
        }

        // Defer UI updates to ensure DOM elements are accessible
        setTimeout(() => {
            updateDelayInputs();
        }, 100); // Small delay to ensure DOM is ready
    });

    // Listener for loaded actual login mode state
    window.ipc.on('tester-actual-login-mode-loaded', (event, isEnabled) => {
        testerState.actualLoginEnabled = !!isEnabled; // Update state

        // Defer UI updates to ensure DOM elements are accessible
        setTimeout(() => {
            updateToggleStates();
            updateTesterButtons(); // Keep this one as it affects button logic immediately
        }, 100); // Small delay to ensure DOM is ready
    });

    // Listener for reload result
    window.ipc.on('tester-reload-list-result', async (event, data) => {
        // Update button state via UI function
        updateTesterButtons();
        if (data && data.success) {
            testerState.accounts = data.accounts || []; // Update state
            testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1; // Update state

            // Load and apply saved state before UI updates
            await loadAndApplySavedState(data.filePath);

            // Defer the UI updates slightly to allow layout calculation
            setTimeout(() => {
                // First render to get elements in DOM
                renderTesterAccountList(true); // Call UI function

                // Then use requestAnimationFrame for a second render after layout
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Final render with correct measurements
                        renderTesterAccountList(true);
                        updateTesterButtons(); // Call UI function
                        updateTesterSummary(); // Call UI function
                        setTesterMessage(`Reloaded ${testerState.accounts.length} accounts from ${data.filePath.split(/[\\/]/).pop()}.`); // Call UI function
                    });
                });

            }, 0); // 0ms timeout defers execution until after current stack clears

        } else {
            setTesterMessage(`Error reloading list: ${data.error}`); // Call UI function
        }
    });

    // Listener for auto-load result (This seems redundant with tester-specific-file-loaded, maybe consolidate?)
    window.ipc.on('tester-auto-load-result', async (event, data) => {
        if (data && data.success) {
            testerState.accounts = data.accounts || []; // Update state
            testerState.currentIndex = testerState.accounts.length > 0 ? 0 : -1; // Update state
            testerState.lastFilePath = data.filePath; // Update state

            // Load and apply saved state before UI updates
            await loadAndApplySavedState(data.filePath);

            // Defer the UI updates slightly to allow layout calculation
            setTimeout(() => {
                // First render to get elements in DOM
                renderTesterAccountList(true); // Call UI function

                // Then use requestAnimationFrame for a second render after layout
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Final render with correct measurements
                        renderTesterAccountList(true);
                        updateTesterButtons(); // Call UI function
                        updateTesterSummary(); // Call UI function
                        setTesterMessage(`Auto-loaded ${testerState.accounts.length} accounts from ${data.filePath.split(/[\\/]/).pop()}.`); // Call UI function
                    });
                });

            }, 0); // 0ms timeout defers execution until after current stack clears

        } else {
            setTesterMessage(`Error auto-loading last file: ${data.error}`); // Call UI function
        }
    });

}

// Function to request initial states
function initializeTesterState() {

    // Add a small delay before sending state requests to ensure UI is ready
    setTimeout(() => {

        // Send all state requests
        window.ipc.send("tester-get-save-path");
        window.ipc.send("tester-get-delays");
        window.ipc.send("tester-get-actual-login-mode");

        // Initiate auto-load directly
        window.ipc.send("tester-get-last-path");

    }, 500); // Delay to ensure UI is fully initialized
}

// Export the initialization functions
export { setupTesterIPCListeners, initializeTesterState };

// Register the real implementations with the bridge
if (window.registerSetupTesterIPCListeners) {
    window.registerSetupTesterIPCListeners(setupTesterIPCListeners);
    // Also expose the initialization function globally for the final init script
    window.initializeTesterState = initializeTesterState;
}
