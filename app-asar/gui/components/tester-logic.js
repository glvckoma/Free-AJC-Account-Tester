// Core account testing loop, authentication calls, and related logic.
"use strict";

import { testerState } from './tester-state.js';
// Import necessary UI functions
import { renderTesterAccountList, updateTesterSummary, setTesterMessage, updateTesterButtons } from './tester-ui.js';
// Assuming 'globals' is accessible globally or passed in during initialization.

// --- Error Message Helper ---
function getFriendlyErrorMessage(error, username = '') {
    const userPart = username ? ` for ${username}` : '';
    let message = `An unexpected error occurred${userPart}.`; // Default message

    if (error) {
        const raw = (error && error.message) ? error.message : '';
        switch (raw) {
            case 'WRONG_CREDENTIALS':
            case 'LOGIN_ERROR': // Treat LOGIN_ERROR similarly
                message = `Invalid username or password${userPart}.`;
                break;
            case 'BANNED':
                message = `Account ${username} is banned.`;
                break;
            case 'SUSPENDED':
                message = `Account ${username} is suspended.`;
                break;
            case 'OTP_NEEDED':
                message = `Account ${username} requires OTP verification.`;
                break;
            case 'FORBIDDEN':
                message = `Access Forbidden (403)${userPart}. IP might be blocked.`;
                break;
            case 'RATE_LIMITED':
                message = `Rate Limited (503)${userPart}. Please wait before retrying.`;
                break;
            // Add more specific mappings as needed
            case 'Failed to fetch':
            case 'NetworkError when attempting to fetch resource.': // Common browser network error
                message = `Network error occurred${userPart}. Check your connection or try again later.`;
                break;
            default:
                // Refine common generic error patterns
                if (/Invalid response code: (\d+|undefined)/i.test(raw)) {
                    message = `The server returned an unexpected response. Please try again later.`;
                } else if (/timeout/i.test(raw)) {
                    message = `The request timed out${userPart}. Please check your connection and try again.`;
                } else if (/fetch/i.test(raw) || /network/i.test(raw)) {
                    message = `A network error occurred${userPart}. Please check your connection.`;
                } else {
                    message = `A server or network error occurred${userPart}. Please try again later.`;
                }
                break;
        }
    }
    return message;
}
// --- End Error Message Helper ---


// Returns the final status string, or a special string ('otp', 'rate-limited', etc.) if testing should pause
async function testAccount(account, index) {
    // Ensure account exists and is pending or was interrupted during testing
    if (!account || (account.status !== 'pending' && account.status !== 'testing')) {
        return account?.status || 'error'; // Return current status if not pending/testing
    }

    account.status = 'testing';
    renderTesterAccountList(); // Update UI to show 'testing' status
    updateTesterSummary(); // Update summary counts
    let finalStatus = 'error'; // Default to error

    try {
        // Store original df value
        const originalDf = globals.df;

        // Check if UUID spoofing is enabled
        let shouldSpoof = false;
        try {
            // Create a Promise to get the UUID spoofing state
            const checkUuidSpoofingPromise = new Promise((resolve) => {
                // Set up a one-time listener for the response
                const listener = (event, isEnabled) => {
                    window.ipc.off('tester-uuid-spoofer-loaded', listener);
                    resolve(isEnabled);
                };
                window.ipc.on('tester-uuid-spoofer-loaded', listener);
                // Send the request
                window.ipc.send('tester-get-uuid-spoofer');
            });

            // Wait for the response with a timeout
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 1000));
            shouldSpoof = await Promise.race([checkUuidSpoofingPromise, timeoutPromise]);
        } catch (err) {
            shouldSpoof = false;
        }

        // Generate new UUID if spoofing is enabled
        const randomDf = window.ipc.uuidv4();

        try {
            // Only replace df with random UUID if spoofing is enabled
            if (shouldSpoof) {
                globals.df = randomDf;
            }

            // Use the existing global authentication function
            await globals.authenticateWithPassword(account.username, account.password);
        } finally {
            // Only restore original df value if we changed it
            if (shouldSpoof) {
                globals.df = originalDf;
            }
        }
        account.status = 'works';
        finalStatus = 'works';
        // Ensure 'window.ipc' is accessible here
        window.ipc.send('tester-save-works', `${account.username}:${account.password}`);
    } catch (err) {
        // Log the raw error message first
        // Track if a known error message has been shown
        let knownErrorShown = false;
        // Check if the error is due to an abort/timeout first
        if (err.name === 'Aborted' || err.name === 'TimedOut') {
            // Signal that the test was interrupted, but don't change the account's visible status.
            finalStatus = 'interrupted'; // Use a specific internal status for loop control.
        } else {
            // Map other error messages to statuses
            switch (err.message) {
                case 'WRONG_CREDENTIALS':
                    account.status = 'invalid';
                    finalStatus = 'invalid';
                    setTesterMessage(getFriendlyErrorMessage(err, account.username), null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'BANNED':
                    account.status = 'banned';
                    finalStatus = 'banned';
                    setTesterMessage(getFriendlyErrorMessage(err, account.username), null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'SUSPENDED':
                    account.status = 'suspended';
                    finalStatus = 'suspended';
                    setTesterMessage(getFriendlyErrorMessage(err, account.username), null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'OTP_NEEDED':
                    account.status = 'otp';
                    finalStatus = 'otp'; // Signal loop to pause
                    setTesterMessage(getFriendlyErrorMessage(err, account.username), null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'FORBIDDEN': // Handle 403 Forbidden
                    account.status = 'pending'; // Keep status as pending to allow retry
                    finalStatus = 'forbidden'; // Signal loop to pause
                    setTesterMessage(getFriendlyErrorMessage(err, account.username) + ' Click Continue to retry.', null, { priority: 'known' });
                    knownErrorShown = false;
                    break;
                case 'RATE_LIMITED': // Handle 503 Rate Limit
                    account.status = 'pending'; // Keep status as pending to allow retry
                    finalStatus = 'rate-limited'; // Signal loop to pause and retry same account
                    // Always show the rate limit message, even if a known error was already shown
                    setTesterMessage(getFriendlyErrorMessage(err, account.username) + ` Auto-retry in ${testerState.retryDelay / 1000}s or click Continue.`, null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'LOGIN_ERROR': // Handle LOGIN_ERROR (typically 401 - bad credentials) as 'invalid' and continue
                    account.status = 'invalid';
                    finalStatus = 'invalid';
                    setTesterMessage(getFriendlyErrorMessage(err, account.username), null, { priority: 'known' });
                    knownErrorShown = true;
                    break;
                case 'ERROR':
                default:
                    account.status = 'pending'; // Keep status as pending to allow retry
                    finalStatus = 'generic-error'; // Signal loop to pause
                    // If this is a rate limit error, always show the message (should be caught above, but double-check)
                    if (err && (err.message === 'RATE_LIMITED' || /rate.?limit|503/i.test(err.message))) {
                        setTesterMessage(getFriendlyErrorMessage(err, account.username) + ` Auto-retry in ${testerState.retryDelay / 1000}s or click Continue.`, null, { priority: 'known' });
                    } else if (!knownErrorShown) {
                        setTesterMessage(getFriendlyErrorMessage(err, account.username) + ' Click Continue to retry.', 5000, { priority: 'generic' });
                    }
                    break;
            }
        }
    } finally {
        // Ensure UI is updated even if errors occur during saving
        // Update UI unless interrupted (status will be updated on next render anyway)
        if (finalStatus !== 'interrupted') {
            renderTesterAccountList(); // Call UI function
        }
        updateTesterSummary(); // Call UI function

        // --- State Saving ---
        // Save the status unless the test was interrupted (aborted/timed out)
        if (finalStatus !== 'interrupted' && testerState.lastFilePath && account) {
            try {

                // Get current state first to merge updates
                // Ensure 'window.ipc' is accessible here
                const currentState = await window.ipc.invoke('get-app-state');
                const accountKey = `${account.username}:${account.password}`;

                // Ensure nested structure exists
                const currentAccountTesterState = currentState.accountTester || {};
                const currentFileStates = currentAccountTesterState.fileStates || {};
                const currentSpecificFileState = currentFileStates[testerState.lastFilePath] || {};

                // Create the new state object by merging
                const newState = {
                    ...currentState,
                    accountTester: {
                        ...currentAccountTesterState,
                        fileStates: {
                            ...currentFileStates,
                            [testerState.lastFilePath]: {
                                ...currentSpecificFileState,
                                [accountKey]: account.status // Update/add the specific account's status
                            }
                        }
                        // Keep existing scrollIndex and filterQuery (handled separately)
                    }
                };

                // Send the updated state back to the main process
                await window.ipc.invoke('set-app-state', newState);
            } catch {}
        }
        // --- End State Saving ---
    }
    // Return status for loop control ('works', 'invalid', 'otp', 'forbidden', 'rate-limited', 'error', 'interrupted', 'generic-error')
    return finalStatus;
}

// Extracted loop logic
async function runTestLoop() {

    // Clear paused state as we are running now (will be set again if needed)
    const previousPausedState = testerState.pausedState;
    testerState.pausedState = 'none';
    setTesterMessage(''); // Clear any previous messages via UI function

    // Update button state *immediately* after clearing pause state if resuming
    // or when starting fresh
    updateTesterButtons(); // Call UI function


    // Determine start index
    let startIndex = 0;
    let initialRetry = false; // Flag for rate-limit retry

    // Determine start index based on pause state
    if (['ratelimit', 'forbidden', 'generic-error'].includes(previousPausedState) && testerState.currentIndex >= 0) {
        // Resuming from rate limit, forbidden, or generic error: retry the *same* index
        startIndex = testerState.currentIndex;
        if (previousPausedState === 'ratelimit') {
            initialRetry = true; // Only set retry flag for rate limit
        }
    } else if (previousPausedState === 'otp' && testerState.currentIndex >= 0) {
        // Resuming from OTP: move to the *next* index
        startIndex = testerState.currentIndex + 1;
    } else if (testerState.currentIndex >= 0) {
        // Starting fresh, continuing after success/error, or resuming after a stop *during* a test
        if (!testerState.isTesting && testerState.currentIndex < testerState.accounts.length - 1) {
            startIndex = testerState.currentIndex + 1;
        } else if (!testerState.isTesting && testerState.currentIndex >= testerState.accounts.length - 1) {
            startIndex = 0;
        } else {
            startIndex = testerState.currentIndex;
        }
    } else {
        startIndex = 0;
    }

    // Ensure startIndex is within bounds if accounts exist
    if (testerState.accounts.length > 0 && startIndex >= testerState.accounts.length) {
        startIndex = 0;
    } else if (testerState.accounts.length === 0) {
        startIndex = -1;
    }

    // Ensure loop doesn't run if startIndex is invalid (-1)
    for (let i = startIndex; i >= 0 && i < testerState.accounts.length; /* i increment handled below */) {
        // Check for STOP request (graceful stop after current)
        if (testerState.shouldStop) {
            break;
        }

        const account = testerState.accounts[i];
        testerState.currentIndex = i; // Update current index

        // --- Auto-scroll ---
        renderTesterAccountList(true); // Call UI function to scroll
        // --- End Auto-scroll ---


        // Handle Retry Logic for Rate Limit
        let currentRetryAttempt = testerState.retryAttempts.get(i) || 0;
        let shouldTestAccount = account.status === 'pending'; // Assume test if pending

        if (initialRetry) {
            initialRetry = false; // Consume the initial retry flag
            currentRetryAttempt++;
            testerState.retryAttempts.set(i, currentRetryAttempt);
            shouldTestAccount = true; // Force test on initial retry

            if (currentRetryAttempt > testerState.MAX_RETRY_ATTEMPTS) {
                account.status = 'error'; // Mark as error after max retries
                setTesterMessage(`Account ${account.username} failed after ${testerState.MAX_RETRY_ATTEMPTS} rate limit retries.`); // Call UI function
                testerState.retryAttempts.delete(i); // Clean up attempt count for this index
                renderTesterAccountList(); // Call UI function
                updateTesterSummary(); // Call UI function
                i++; // Move to the next account
                continue; // Skip testing this account further
            } else {
                setTesterMessage(`Retrying account ${account.username} (attempt ${currentRetryAttempt}/${testerState.MAX_RETRY_ATTEMPTS}) after ${testerState.retryDelay / 1000}s delay...`, null); // Call UI function
                await new Promise(resolve => setTimeout(resolve, testerState.retryDelay));
                // Check for STOP request *during* the delay
                if (testerState.shouldStop) {
                    break;
                }
                setTesterMessage(`Retrying account ${account.username} (attempt ${currentRetryAttempt}/${testerState.MAX_RETRY_ATTEMPTS})...`, null); // Call UI function
            }
        } else if (account.status === 'pending') {
            // If it's a normal pending test (not a retry), reset attempt count for this index
            testerState.retryAttempts.delete(i);
        }


        if (shouldTestAccount) {
            renderTesterAccountList(); // Update selection visually before test via UI function
            const resultStatus = await testAccount(account, i); // Pass index

            // Handle pausing based on result
            if (resultStatus === 'otp') {
                testerState.pausedState = 'otp';
                testerState.retryAttempts.delete(i); // Reset retries if OTP occurs
                await waitForOtpModalClose(); // This still needs access to the DOM/modal
                updateTesterButtons(); // Update button to "Continue" via UI function
                return; // Exit the loop function, wait for user
            } else if (resultStatus === 'rate-limited') {
                testerState.pausedState = 'ratelimit';
                // Retry attempts handled at the start of the next loop iteration for this index
                updateTesterButtons(); // Update button to "Continue" via UI function
                return; // Exit the loop function, wait for user
            } else if (resultStatus === 'forbidden') {
                testerState.pausedState = 'forbidden';
                testerState.retryAttempts.delete(i); // Reset retries if forbidden occurs
                updateTesterButtons(); // Update button to "Continue" via UI function
                return; // Exit the loop function, wait for user
            } else if (resultStatus === 'generic-error') {
                testerState.pausedState = 'generic-error';
                testerState.retryAttempts.delete(i); // Reset retries if generic error occurs
                updateTesterButtons(); // Update button to "Continue" via UI function
                return; // Exit the loop function, wait for user
            } else if (resultStatus === 'interrupted') { // Handle the 'interrupted' status
                // Do not increment i here. The loop's main stop/cancel checks at the top will handle termination.
            } else {
                // Account processed successfully or failed with non-retryable error
                testerState.retryAttempts.delete(i); // Reset retry count for this index
                // Increment index ONLY if the loop didn't pause/exit AND wasn't interrupted
                if (resultStatus !== 'interrupted') {
                    i++;
                }
            }


            // Delay before next account only if loop is continuing (not paused, stopped, or interrupted)
            if (i < testerState.accounts.length && !testerState.shouldStop && testerState.pausedState === 'none') {
                await new Promise(resolve => setTimeout(resolve, testerState.interTestDelay));
                // Check for STOP request *during* the delay
                if (testerState.shouldStop) {
                    break;
                }
            }
        } else {
            // If account is not pending (and not an initial retry), reset its retry count and move to the next one
            testerState.retryAttempts.delete(i);
            renderTesterAccountList(); // Update selection visually via UI function
            i++; // Move to the next index
        }
    }

    // Loop finished (either completed or stopped)
    testerState.isTesting = false;
    testerState.shouldStop = false; // Reset stop flag
    testerState.pausedState = 'none'; // Reset pause state
    // Ensure 'globals' is accessible here
    if (globals.currentAbortController) {
        globals.currentAbortController = null; // Clear the abort controller
    }
    updateTesterButtons(); // Reset button states via UI function
    updateTesterSummary(); // Update summary via UI function
    setTesterMessage(''); // Clear message via UI function
}

// Helper to wait for OTP modal to close - This still needs DOM access
// It might need to live in tester-ui.js or be passed the modal layer element.
async function waitForOtpModalClose() {
    // TODO: This needs access to the main document's modal layer.
    // This function likely needs to be moved or adapted.
    const modalLayer = document.getElementById("modal-layer"); // This won't work directly here
    if (!modalLayer || !modalLayer.querySelector("otp-modal")) {
        return;
    }
    return new Promise(resolve => {
        const observer = new MutationObserver((mutationsList, observer) => {
            if (!modalLayer.querySelector("otp-modal")) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(modalLayer, { childList: true });
    });
}

// Processes the currently selected account, marking it with a given status
// This might be better placed in tester-ui.js as it directly triggers UI updates and IPC based on user action (shortcuts)
async function processCurrentAccount(status) {
    // Allow processing even if paused, but not if actively testing an account right now
    if ((testerState.isTesting && testerState.pausedState === 'none') || testerState.currentIndex === -1) {
        return;
    }

    const account = testerState.accounts[testerState.currentIndex];
    if (!account || account.status === status) {
        return; // No change needed
    }

    account.status = status;

    // Save based on status
    const accountString = `${account.username}:${account.password}`;
    if (status === 'works') {
        // For 'works' status, we need to verify with a randomized UUID login attempt

        // Store original df value
        const originalDf = globals.df;

        // Check if UUID spoofing is enabled
        let shouldSpoof = false;
        try {
            // Create a Promise to get the UUID spoofing state
            const checkUuidSpoofingPromise = new Promise((resolve) => {
                // Set up a one-time listener for the response
                const listener = (event, isEnabled) => {
                    window.ipc.off('tester-uuid-spoofer-loaded', listener);
                    resolve(isEnabled);
                };
                window.ipc.on('tester-uuid-spoofer-loaded', listener);
                // Send the request
                window.ipc.send('tester-get-uuid-spoofer');
            });

            // Wait for the response with a timeout
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(false), 1000));
            shouldSpoof = await Promise.race([checkUuidSpoofingPromise, timeoutPromise]);
        } catch (err) {
            shouldSpoof = false;
        }

        // Generate new UUID if spoofing is enabled
        const randomDf = window.ipc.uuidv4();

        try {
            // Only replace df with random UUID if spoofing is enabled
            if (shouldSpoof) {
                globals.df = randomDf;
            }

            // Verify the account works
            await globals.authenticateWithPassword(account.username, account.password);
            // Send save IPC after successful verification
            window.ipc.send('tester-save-works', accountString);
        } catch (err) {
            // If verification fails, set status back to pending
            account.status = 'pending';
            // Use helper function for message
            setTesterMessage(getFriendlyErrorMessage(err, account.username));
        } finally {
            // Only restore original df value if we changed it
            if (shouldSpoof) {
                globals.df = originalDf;
            }
        }
    }

    renderTesterAccountList(); // Call UI function
    updateTesterSummary(); // Call UI function

    // Optionally move to the next account *only if not paused*
    if (testerState.pausedState === 'none' && testerState.currentIndex < testerState.accounts.length - 1) {
        testerState.currentIndex++;
        renderTesterAccountList(); // Update selection visually via UI function
    }
    updateTesterButtons(); // Update button states via UI function
}


// Export the functions to be used by other modules (mainly tester-ui.js)
export {
    testAccount,
    runTestLoop,
    waitForOtpModalClose, // Note: This function needs DOM access adaptation
    processCurrentAccount, // Note: This function might be better in tester-ui.js
    updateTesterAccountStatus // Export the new function
};

// --- New Status Update Function ---
async function updateTesterAccountStatus(index, status, error = null) {

    if (index < 0 || index >= testerState.accounts.length) {
        return;
    }

    const account = testerState.accounts[index];
    if (!account) {
        return;
    }

    // Update status
    account.status = status;

    // Update UI
    renderTesterAccountList();
    updateTesterSummary();

    // Show error message if provided
    if (error) {
        setTesterMessage(getFriendlyErrorMessage(error, account.username), null, { priority: 'known' });
    }

    // Save state
    if (testerState.lastFilePath) {
        try {
            const currentState = await window.ipc.invoke('get-app-state');
            const accountKey = `${account.username}:${account.password}`;
            const currentAccountTesterState = currentState.accountTester || {};
            const currentFileStates = currentAccountTesterState.fileStates || {};
            const currentSpecificFileState = currentFileStates[testerState.lastFilePath] || {};

            const newState = {
                ...currentState,
                accountTester: {
                    ...currentAccountTesterState,
                    fileStates: {
                        ...currentFileStates,
                        [testerState.lastFilePath]: {
                            ...currentSpecificFileState,
                            [accountKey]: account.status
                        }
                    }
                }
            };
            await window.ipc.invoke('set-app-state', newState);
        } catch {}
    }
}

// Register with the bridge
if (window.registerUpdateTesterAccountStatus) {
    window.registerUpdateTesterAccountStatus(updateTesterAccountStatus);
}
