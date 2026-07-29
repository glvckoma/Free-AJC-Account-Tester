"use strict";

// Note: Tester UI and IPC initialization functions (initTesterUI, setupTesterIPCListeners)
// are now called directly in the constructor. They are expected to be globally available
// after their respective modules (tester-ui.js, tester-ipc.js) are loaded in index.html.

(() => {
  let forgotBlocked = false;

  const forgotPassword = () => {
    if (forgotBlocked) {
      return;
    }
    forgotBlocked = true;

    const modal = document.createElement("ajd-forgot-password-modal");
    modal.addEventListener("close", event => {
      document.getElementById("modal-layer").removeChild(modal);
      forgotBlocked = false;
    });
    document.getElementById("modal-layer").appendChild(modal);
  };

  customElements.define("ajd-login-screen", class extends HTMLElement {
    static get observedAttributes() {
      return [];
    }

    constructor() {
      super();

      this.attachShadow({mode: "open"}).innerHTML = `
        <style>
          /* Link the external CSS file */
          @import url('components/LoginScreenTester.css');

          :host {
            width: 100vw;
            height: calc(100vh - 2px);
            display: grid;
            /* Adjusted grid to make space for tester */
            grid-template: 1fr 590px 1fr / 1fr 586px 350px 1fr; /* Login | Tester */
            grid-template-areas: ". . . button-tray"
                                 ". box tester ."        /* Added tester area */
                                 ". . . .";
            background-color: rgba(239, 234, 221, 0);
            transition: background-color 0.2s;
          }

          .hidden {
            display: none !important;
          }

          #box-background {
            /* Span across login and tester areas */
            grid-area: box / box / box / tester;
            border-image: url(images/electron_login/log_bg_page.svg) 0 fill stretch;
            opacity: 1;
            transition: opacity 0.2s;
          }

          /* Media query needs adjustment if tester should also hide */
          @media (max-width: 950px), (max-height: 590px) {
            #box-background {
              z-index: -1;
              opacity: 0;
            }

            :host {
              background-color: rgba(239, 234, 221, 1);
            }
            /* Hide tester on smaller screens? */
             #tester-container {
               display: none;
             }
             /* Reset grid for login only */
             :host {
                grid-template: 1fr 590px 1fr / 1fr 936px 1fr;
                grid-template-areas: ". . button-tray"
                                     ". box ."
                                     ". . .";
             }
             #box { /* Ensure login box takes full area */
                grid-area: box;
             }

          }

          #box {
            grid-area: box;
            display: flex;
            justify-content: center;
            align-items: center; /* Added for vertical centering */
            /* Removed border-image, handled by #box-background */
            padding: 50px 70px 50px;
            /* Ensure it doesn't overlap tester visually */
            /* position: relative; */ /* REMOVED */
            /* z-index: 1; */         /* REMOVED */
          }

          #login-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          #login-container > * {
            margin-bottom: 9px;
          }

          #login-image {
            user-select: none;
            pointer-events: none;
            grid-area: left;
          }

          #need-account {
            user-select: none;
            pointer-events: none;
            font-size: 12px;
            line-height: 18px;
            letter-spacing: -0.25px;
            color: #6E4B37;
            font-family: CCDigitalDelivery;
            font-weight: bold;
          }

          #player-login-text {
            color: #684A26;
            font-family: Tiki-Island;
            font-size: 36px;
            text-shadow: 1px 2px 0px rgba(2, 2, 2, 0.2);
          }

          #login-btn-container {
            display: grid;
            grid-template: 1fr / 1fr fit-content(100%) 1fr;
            grid-template-areas: "left mid right";
            align-items: center;
          }

          #log-in-btn {
            grid-area: mid;
            padding: 6px 24px;
          }

          @keyframes fade {
            0%,100% { opacity: 0 }
            50% { opacity: 1 }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(-360deg);
            }
          }

          #spinner {
            margin-left: 10px;
            grid-area: left;
            height: 90%;
            opacity: 0;
            transition: opacity .5s;
            animation: spin 1500ms linear infinite;
          }

          /* --- Fruit Rotation Animation (Simple Pop) --- */
          @keyframes fruit-pop {
            0%   { transform: scale(1); } /* Start normal */
            50%  { transform: scale(1.25); } /* Pop bigger */
            100% { transform: scale(1); } /* Settle to normal size */
          }

          .fruit-animate {
            /* Apply the animation */
            animation: fruit-pop 0.3s ease-out; /* Quick pop */
            /* Ensure the image flips back correctly if starting flipped */
            transform-style: preserve-3d;
          }
          /* --- End Fruit Rotation Animation --- */

          #spinner.show {
            opacity: 1;
          }

          ajd-text-input {
            width: 100%;
            border-radius: 25px;
            border: #BFAE92 2px solid;
          }

          #remember-me-cb {
            font-size: 15px;
            letter-spacing: -1px;
            font-weight: bold;
          }

          #forgot-password-link {
            font-size: 12px;
            line-height: 14px;
            letter-spacing: .25px;
            color: #CC6C2B;
            text-decoration: none;
            user-select: none;
            cursor: pointer;
            font-family: CCDigitalDelivery;
          }

          .vertical-spacer {
            height: 2px;
            width: 75%;
            border-bottom: #cea054 2px solid;
          }

          #forgot-password-link {
            letter-spacing: -0.5px;
          }

          #forgot-password-link:hover {
            text-decoration: underline;
          }

          #create-account-btn {
            font-size: 24px;
            padding: 4px 12px;
          }

          #tester-project-attribution {
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 310px;
            margin-top: -2px;
            color: #8A6A4A;
            font-family: CCDigitalDelivery;
            font-size: 11px;
            line-height: 14px;
            text-align: center;
          }

          #tester-project-link {
            color: #CC6C2B;
            text-decoration: none;
            cursor: pointer;
          }

          #tester-project-link:hover,
          #tester-project-link:focus-visible {
            text-decoration: underline;
          }

          #version {
            position: absolute;
            right: 10px;
            bottom: 10px;
            display: grid;
            grid-template-columns: 1fr 24px;
          }

          #version:hover {
            text-decoration: underline;
          }

          #version-link {
            font-size: 16px;
            line-height: 24px;
            letter-spacing: -0.5px;
            color: #684A26;
            text-decoration: none;
            user-select: none;
            cursor: pointer;
            font-family: CCDigitalDelivery;
          }

          #version-status-icon {
            background: url(images/core/core_form_input_status_icn_sprite.svg);
            background-repeat: no-repeat;
            background-size: 80px;
            width: 20px;
            height: 20px;
            opacity: 0.0;
          }

          #version-status-icon.check {
            background-position: -20px 0px;
            animation: spin 1500ms linear infinite;
            opacity: 1.0;
            transition-property: opacity;
            transition-duration: 0.5s;
          }

          #version-status-icon.download {
            opacity: 1.0;
          }

          #version-status-icon.restart {
            background-position: -40px 0px;
            opacity: 0.0;
            animation: fade 1.5s ease-out infinite;
          }

          #version-status-icon.error {
            background-position: -60px 0px;
            opacity: 0.0;
            animation: fade 1.5s ease-out infinite;
          }

          #button-tray {
            grid-area: button-tray;
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
          }
          #button-tray ajd-button {
            width: 54px;
            height: 54px;
          }

          /* --- Tester Styles Removed - Moved to LoginScreenTester.css --- */

        </style>
        <div id="box-background"></div>
        <div id="button-tray" class="hidden">
          <ajd-button graphic="UI_fullScreen" id="expand-button">
          </ajd-button>
          <ajd-button graphic="UI_power" id="close-button">
          </ajd-button>
        </div>
        <div id="box">
<div id="login-container">
  <img src="images/strawberry.png" alt="App Icon" id="login-app-icon" style="width:90px;display:block;margin-bottom:8px;margin-left:auto;margin-right:auto;"> <!-- Changed default src -->
  <div id="player-login-text">playerLogin</div>
  <ajd-text-input id="username-input" placeholder="username" type="text"></ajd-text-input>
            <ajd-text-input id="password-input" placeholder="password" type="password"></ajd-text-input>
            <ajd-checkbox id="remember-me-cb" text="rememberMeText"></ajd-checkbox>
            <div id="login-btn-container">
              <ajd-bubble-button id="log-in-btn" text="login"></ajd-bubble-button>
              <img id="spinner" src="images/electron_login/log_spinner.svg"></img>
            </div>
            <a id="forgot-password-link">forgotPassword</a>
            <div class="vertical-spacer"></div>
            <div id="need-account">needAccount?</div>
            <ajd-bubble-button id="create-account-btn" text="createAnimal"></ajd-bubble-button>
            <div id="tester-project-attribution">
              <span>Completely free, available at:</span>
              <a id="tester-project-link" href="https://github.com/glvckoma/Free-AJC-Account-Tester" rel="noopener noreferrer">glvckoma/Free-AJC-Account-Tester</a>
            </div>
          </div>
        </div>

        <!-- --- Tester UI --- -->
        <div id="tester-container">
<div id="tester-header"> <!-- Added header container -->
  <h3>Account Tester</h3>
  <button id="tester-settings-btn" title="Settings"></button> <!-- Updated tooltip -->
</div>
          <div id="tester-settings-panel"> <!-- Added settings panel -->
            <!-- --- REMOVED tester-save-controls div --- -->
            <!-- Delay Controls -->
            <div id="tester-delay-controls" style="margin-top: 10px; font-size: 12px;">
              <label for="tester-inter-test-delay">Delay Between Tests (ms):</label>
              <input type="number" id="tester-inter-test-delay" value="1000" min="0" step="100" style="width: 60px; margin-left: 5px;">
              <br>
              <label for="tester-retry-delay">503 Retry Delay (ms):</label>
              <input type="number" id="tester-retry-delay" value="10000" min="0" step="500" style="width: 60px; margin-left: 5px; margin-top: 5px;">
            </div>
            <!-- End Delay Controls -->
            <!-- Actual Login Toggle (MOVED TO MAIN CONTROLS) -->
            <!-- UUID Spoofer Toggle -->
            <div id="tester-uuid-spoofer-controls" style="margin-top: 10px; font-size: 12px;">
              <input type="checkbox" id="tester-uuid-spoofer-toggle" style="vertical-align: middle;">
              <label for="tester-uuid-spoofer-toggle" style="vertical-align: middle;">Enable UUID Spoofing</label>
            </div>
            <!-- End UUID Spoofer Toggle -->
          </div> <!-- End settings panel -->
          <div id="tester-controls">
            <div class="tester-control-row tester-file-actions">
              <button id="tester-load-btn" title="Load accounts from a text file">Load Accounts</button>
              <button id="tester-reload-btn" disabled title="Reload the current account file">Reload List</button>
              <button id="tester-cleanup-btn" disabled title="Permanently remove tested accounts from the current file">Cleanup Tested</button>
            </div>
            <label id="tester-actual-login-control" for="tester-actual-login-toggle" title="Log into the selected account instead of only testing its credentials">
              <input type="checkbox" id="tester-actual-login-toggle">
              <span class="tester-toggle-track" aria-hidden="true">
                <span class="tester-toggle-thumb"></span>
              </span>
              <span class="tester-toggle-copy">
                <span class="tester-toggle-title">Actual login</span>
                <span class="tester-toggle-description">Selected account only</span>
              </span>
            </label>
            <div class="tester-control-row tester-test-actions">
              <button id="tester-test-selected-btn" disabled title="Test the selected account">Test Selected</button>
              <button id="tester-test-all-btn" disabled title="Test every loaded account">Test All</button>
            </div>
          </div>
          <input type="text" id="tester-filter-input" placeholder="Filter accounts..." style="margin: 5px 8px; width: calc(100% - 16px); box-sizing: border-box;"> <!-- Added Filter Input -->
          <ul id="tester-account-list">
            <!-- Account items will be added here -->
          </ul>
          <div id="tester-message" style="color: #cc6c2b; margin-top: 5px; font-weight: bold; min-height: 1em;"></div> <!-- Moved message area above summary -->
          <div id="tester-status-summary">Loaded: 0 | Tested: 0 | Works: 0 | Invalid: 0 | Other: 0</div>
          <div id="tester-credit">Created by Glvckoma</div>
        </div>
        <!-- --- End Tester UI --- -->

        <div id="version">
          <a id="version-link">0.0.0</a>
          <ajd-progress-ring id="version-status-icon" stroke-color="#64cc4d" stroke-width="3" radius="11"></ajd-progress-ring>
        </div>
      `;

      // --- Core Login State ---
      this._authToken = null;
      this._refreshToken = null;
      this._otp = null;
      this._isFakePassword = false;
      this._version = "";

      // --- Core Login Element References ---
      this.loginSpinnerElem = this.shadowRoot.getElementById("spinner");
      this.versionElem = this.shadowRoot.getElementById("version");
      this.versionLinkElem = this.shadowRoot.getElementById("version-link");
      this.versionStatusIconElem = this.shadowRoot.getElementById("version-status-icon");
      this.usernameInputElem = this.shadowRoot.getElementById("username-input");
      this.passwordInputElem = this.shadowRoot.getElementById("password-input");
      this.rememberMeElem = this.shadowRoot.getElementById("remember-me-cb");
      this.forgotPasswordLinkElem = this.shadowRoot.getElementById("forgot-password-link");
      this.needAccountElem = this.shadowRoot.getElementById("need-account");
      this.createAnAnimalTextElem = this.shadowRoot.getElementById("create-an-animal"); // Note: Element ID seems incorrect in original HTML?
      this.playerLoginTextElem = this.shadowRoot.getElementById("player-login-text");
      this.createAccountElem = this.shadowRoot.getElementById("create-account-btn");
      this.testerProjectLinkElem = this.shadowRoot.getElementById("tester-project-link");
      this.logInButtonElem = this.shadowRoot.getElementById("log-in-btn");
      this.expandButtonElement = this.shadowRoot.getElementById("expand-button");
      this.closeButtonElement = this.shadowRoot.getElementById("close-button");

      // --- Tester Element References (Still needed for initTesterUI) ---
      // Note: These are just references now; state and logic are external.
      this.testerLoadBtn = this.shadowRoot.getElementById("tester-load-btn");
      this.testerTestSelectedBtn = this.shadowRoot.getElementById("tester-test-selected-btn");
      this.testerTestAllBtn = this.shadowRoot.getElementById("tester-test-all-btn");
      this.testerReloadBtn = this.shadowRoot.getElementById("tester-reload-btn");
      this.testerClearBtn = this.shadowRoot.getElementById("tester-clear-btn");
      this.testerAccountList = this.shadowRoot.getElementById("tester-account-list");
      this.testerStatusSummary = this.shadowRoot.getElementById("tester-status-summary");
      this.testerMessage = this.shadowRoot.getElementById("tester-message");
      this.testerSettingsBtn = this.shadowRoot.getElementById("tester-settings-btn");
      this.testerSettingsPanel = this.shadowRoot.getElementById("tester-settings-panel");
      this.testerCleanupBtn = this.shadowRoot.getElementById("tester-cleanup-btn");
      this.testerFileSwapBtns = this.shadowRoot.querySelectorAll(".file-swap-btn");
      this.testerFilterInput = this.shadowRoot.getElementById("tester-filter-input");
      // this.testerSelectSaveBtn = this.shadowRoot.getElementById("tester-select-save-btn"); // Removed reference
      // this.testerSavePathDisplay = this.shadowRoot.getElementById("tester-save-path-display"); // Removed reference
      this.testerInterTestDelayInput = this.shadowRoot.getElementById("tester-inter-test-delay");
      this.testerRetryDelayInput = this.shadowRoot.getElementById("tester-retry-delay");
      this.testerActualLoginToggle = this.shadowRoot.getElementById("tester-actual-login-toggle");
      this.testerUuidSpooferToggle = this.shadowRoot.getElementById("tester-uuid-spoofer-toggle");
      this.loginAppIconElem = this.shadowRoot.getElementById("login-app-icon"); // Get reference to the icon

      // --- Fruit Rotation Logic ---
      const fruitImages = [
        "images/banana.png",
        "images/blueberries.png",
        "images/cantaloupe.png",
        "images/coconut.png",
        "images/pineapple.png",
        "images/strawberry.png" // Removed icon.png
      ];
      // Find the index of the currently displayed fruit, default to strawberry if not found or if it was icon.png
      let currentFruitIndex = fruitImages.findIndex(src => this.loginAppIconElem.src.endsWith(src));
      if (currentFruitIndex === -1) currentFruitIndex = fruitImages.length - 1; // Default to last item (strawberry)

      this.loginAppIconElem.style.cursor = 'pointer'; // Make it look clickable
      this.loginAppIconElem.addEventListener('click', () => {
        // 1. Calculate next index
        currentFruitIndex = (currentFruitIndex + 1) % fruitImages.length;

        // 2. Update the image source BEFORE animation
        this.loginAppIconElem.src = fruitImages[currentFruitIndex];

        // 3. Trigger the animation
        this.loginAppIconElem.classList.remove('fruit-animate'); // Remove class if already there
        // Force reflow/repaint to ensure animation restarts
        void this.loginAppIconElem.offsetWidth;
        this.loginAppIconElem.classList.add('fruit-animate');

        // Remove the class after animation completes to allow re-triggering on next click
        setTimeout(() => {
            if (this.loginAppIconElem) { // Check if element still exists
                 this.loginAppIconElem.classList.remove('fruit-animate');
            }
        }, 300); // Match animation duration (0.3s)
      });
      // --- End Fruit Rotation Logic ---

      // --- Core Login Event Listeners ---
      this.loginSpinnerElem.addEventListener("click", event => {
        if (globals.userAbortController) globals.userAbortController.abort();
      });
      this.versionElem.addEventListener("click", () => {
        window.ipc.send("about");
      });
      this.usernameInputElem.addEventListener("keydown", event => event.key === "Enter" ? this.logIn() : "");
      this.usernameInputElem.addEventListener("input", event => {
        if (this.authToken) this.clearAuthToken();
        if (this.refreshToken) this.clearRefreshToken();
      });
      this.passwordInputElem.addEventListener("keydown", event => event.key === "Enter" ? this.logIn() : "");
      this.passwordInputElem.addEventListener("input", event => {
        if (this.isFakePassword) this.isFakePassword = false;
        if (this.authToken) this.clearAuthToken();
        if (this.refreshToken) this.clearRefreshToken();
      });
      this.rememberMeElem.addEventListener("click", event => {
        window.ipc.send("rememberMeStateUpdated", {newValue: this.rememberMeElem.value});
      });
      this.forgotPasswordLinkElem.addEventListener("click", () => {
        if (this.loginBlocked) return;
        forgotPassword();
      });
      this.createAccountElem.addEventListener("click", async () => {
        if (this.loginBlocked) return;
        this.loginBlocked = true;
        try {
          const flashVars = await globals.getFlashVarsFromWeb();
          Object.assign(
            flashVars,
            globals.getClientData(),
            { locale: globals.language, webRefPath: "create_account" },
            globals.affiliateCode ? { affiliate_code: globals.affiliateCode } : {}
          );
          this.dispatchEvent(new CustomEvent("loggedIn", {detail: {flashVars}}));
        } catch (err) {
          globals.reportError("webClient", `Error creating account: ${err.stack || err.message}`);
          if (err.name != "Aborted") window.alert("Something went wrong :(");
          this.loginBlocked = false;
        }
      });
      this.testerProjectLinkElem.addEventListener("click", event => {
        event.preventDefault();
        window.ipc.send("openTesterProject");
      });
      this.logInButtonElem.addEventListener("click", () => {
          globals.currentAbortController = new AbortController();
          this.logIn();
      });
      this.expandButtonElement.addEventListener("click", event => {
        window.ipc.send("systemCommand", {command: "toggleFullScreen"});
      });
      this.closeButtonElement.addEventListener("click", event => {
        window.ipc.send("systemCommand", {command: "exit"});
      });

      // --- Core Login IPC Listeners ---
      window.ipc.on("autoUpdateStatus", (event, data) => {
        for (const state of ["check", "download", "restart", "error"]) {
          this.versionStatusIconElem.classList.remove(state);
          if (state == data.state) this.versionStatusIconElem.classList.add(data.state);
        }
        this.setProgress(data.progress || null);
      });
      window.ipc.on("screenChange", (event, state) => {
        const buttonTray = this.shadowRoot.getElementById("button-tray");
        if (state === "fullScreen" && globals.systemData.platform === "win32") {
          buttonTray.classList.remove("hidden");
        } else {
          buttonTray.classList.add("hidden");
        }
      });

      // --- Tester Initialization ---
      // initTesterUI no longer needs 'this' passed
      initTesterUI(this.shadowRoot); // Initialize UI elements and listeners
      setupTesterIPCListeners(); // Setup IPC message handlers

      // Initialize UUID spoofer toggle
      window.ipc.send('tester-get-uuid-spoofer');
      window.ipc.on('tester-uuid-spoofer-loaded', (event, isEnabled) => {
        this.testerUuidSpooferToggle.checked = isEnabled;
      });
      this.testerUuidSpooferToggle.addEventListener('change', () => {
        window.ipc.send('tester-set-uuid-spoofer', this.testerUuidSpooferToggle.checked);
      });

    } // End Constructor

    // --- Core Login Methods ---
    // Updated logIn method to handle testerAccountIndex
    async logIn(isRetry = false, customDf = null, testerAccountIndex = -1) {
      if (!isRetry && this.loginBlocked) {
        return;
      }
      this.loginBlocked = true;

      try {
        this.usernameInputElem.error = "";
        this.passwordInputElem.error = "";

        let authResult;
        if (this.authToken) {
          authResult = await globals.authenticateWithAuthToken(this.authToken);
        } else if (this.refreshToken) {
          authResult = await globals.authenticateWithRefreshToken(this.refreshToken, this.otp);
        } else {
          if (!this.username.length) throw new Error("EMPTY_USERNAME");
          if (!this.password.length) throw new Error("EMPTY_PASSWORD");
          authResult = await globals.authenticateWithPassword(this.username, this.password, this.otp, customDf);
        }
        this.otp = null;
        const {userData, flashVars} = authResult;
        const data = {
          username: userData.username,
          authToken: userData.authToken,
          refreshToken: userData.refreshToken,
          accountType: userData.accountType,
          language: userData.language,
          rememberMe: this.rememberMeElem.value,
        };
        if (userData.authToken) this.authToken = userData.authToken;
        if (userData.refreshToken) this.refreshToken = userData.refreshToken;
        window.ipc.send("loginSucceeded", data);

        // --- Update Tester Status on Success ---
        if (testerAccountIndex >= 0 && window.updateTesterAccountStatus) {
            window.updateTesterAccountStatus(testerAccountIndex, 'works');
        }
        // --- End Tester Status Update ---

        this.dispatchEvent(new CustomEvent("loggedIn", {detail: {flashVars}}));
        // loginBlocked = false handled below
      } catch (err) {
        // --- Update Tester Status on Error ---
        let testerStatus = 'pending'; // Default to pending for errors that don't map directly
        if (err && err.message) {
            switch (err.message) {
                case 'WRONG_CREDENTIALS':
                case 'LOGIN_ERROR':
                    testerStatus = 'invalid';
                    break;
                case 'BANNED':
                    testerStatus = 'banned';
                    break;
                case 'SUSPENDED':
                    testerStatus = 'suspended';
                    break;
                // OTP_NEEDED, RATE_LIMITED, FORBIDDEN, etc., should keep status as 'pending' or let tester-logic handle pause states
            }
        }
        if (testerAccountIndex >= 0 && window.updateTesterAccountStatus) {
            window.updateTesterAccountStatus(testerAccountIndex, testerStatus, err); // Pass error object too
        }
        // --- End Tester Status Update ---

        // Keep the existing loginBlocked = false in the catch block
        if (err.message) {
          switch (err.message) {
            case "SUSPENDED": this.usernameInputElem.error = await globals.translate("userSuspended"); break;
            case "BANNED": this.usernameInputElem.error = await globals.translate("userBanned"); break;
            case "LOGIN_ERROR": this.usernameInputElem.error = await globals.translate("loginError"); break;
            case "WRONG_CREDENTIALS": this.passwordInputElem.error = await globals.translate("wrongCredentials"); break;
            case "EMPTY_USERNAME": this.usernameInputElem.error = await globals.translate("usernameRequired"); break;
            case "EMPTY_PASSWORD": this.passwordInputElem.error = await globals.translate("emptyPassword"); break;
            case "USER_RENAME_NEEDED": /* handled by modal */ break;
            case "OTP_NEEDED": /* handled by modal */ break;
            case "RATE_LIMITED": this.passwordInputElem.error = "Rate limited. Try again later."; break; // Keep UI error message
            case "AUTH_TOKEN_EXPIRED":
              this.clearAuthToken();
              if (this.canRetry()) setTimeout(() => this.logIn(true), 1000);
              else { this.isFakePassword = false; this.password = ""; }
              break;
            case "REFRESH_TOKEN_EXPIRED":
              this.clearRefreshToken();
              if (this.canRetry()) setTimeout(() => this.logIn(true), 1000);
              else { this.isFakePassword = false; this.password = ""; }
              break;
            default:
              globals.reportError("webClient", `Error logging in: ${err.stack || err.message}`);
              if (err.name != "Aborted") window.alert("Something went wrong :(");
              break;
          }
        } else {
          globals.reportError("webClient", `Error logging in: ${err}`);
          if (err.name != "Aborted") window.alert("Something went wrong :(");
        }
        // Only unblock if it wasn't an OTP error (modal handles OTP)
        // Moved this check from finally block to ensure 'err' is defined
        if (err?.message !== "OTP_NEEDED") {
             this.loginBlocked = false;
        }
      } finally {
        // Code that needs to run regardless of success/error, but doesn't depend on 'err'
        // If loginBlocked wasn't set to false in the catch block (due to OTP),
        // it remains true here, which is correct. If it was set to false, it stays false.
      }
    }

    canRetry() {
      return (this.authToken !== null || this.refreshToken !== null ||
        (this.username && this.password && !this.isFakePassword));
    }

    get loginBlocked() {
      // Check if elements exist before accessing disabled property
      const loginButtonDisabled = this.logInButtonElem ? this.logInButtonElem.disabled : true;
      const createAccountDisabled = this.createAccountElem ? this.createAccountElem.disabled : true;
      return loginButtonDisabled || createAccountDisabled;
    }

    set loginBlocked(val) {
       // Check if elements exist before setting disabled property
      if (this.logInButtonElem) this.logInButtonElem.disabled = val;
      if (this.createAccountElem) this.createAccountElem.disabled = val;
      if (this.loginSpinnerElem) {
          if (val) {
              this.loginSpinnerElem.classList.add("show");
          } else {
              // Use a shorter delay for removing spinner visually
              setTimeout(() => {
                  if (this.loginSpinnerElem) this.loginSpinnerElem.classList.remove("show");
              }, 250);
          }
      }
      // Clear abort controller only if unblocking and not related to tester
      if (!val && !this._testerIsTesting && globals.currentAbortController) { // _testerIsTesting needs to come from state
          globals.currentAbortController = null;
      }
    }

    get username() { return this.usernameInputElem.value; }
    set username(val) { this.usernameInputElem.value = val; }
    get password() { return this.passwordInputElem.value; }
    set password(val) { this.passwordInputElem.value = val; }
    get isFakePassword() { return this._isFakePassword; }
    set isFakePassword(val) {
      this._isFakePassword = val;
      if (val) this.password = "FAKE_PASSWORD";
    }
    get rememberMe() { return this.rememberMeElem.value; }
    set rememberMe(val) { this.rememberMeElem.value = val; }
    get version() { return this._version; }
    set version(val) {
      this._version = val;
      this.versionLinkElem.innerHTML = `v${val}`;
    }
    setProgress(progress) {
      if (progress === null) {
        this.versionStatusIconElem.setAttribute("progress", 0);
        this.version = this._version;
      } else {
        this.versionStatusIconElem.setAttribute("progress", progress);
        this.versionLinkElem.innerHTML = `${progress}%`;
      }
    }
    get otp() { return this._otp; }
    set otp(val) { this._otp = val; }
    get authToken() { return this._authToken; }
    set authToken(val) { this._authToken = val; }
    clearAuthToken() {
      this.authToken = null;
      window.ipc.send("clearAuthToken");
    }
    get refreshToken() { return this._refreshToken; }
    set refreshToken(val) { this._refreshToken = val; }
    clearRefreshToken() {
      this.refreshToken = null;
      window.ipc.send("clearRefreshToken");
    }

    async localize() {
      this.usernameInputElem.placeholder = await globals.translate("username");
      this.passwordInputElem.placeholder = await globals.translate("password");
      this.rememberMeElem.text = await globals.translate("rememberMeText");
      this.logInButtonElem.text = await globals.translate("login");
      this.forgotPasswordLinkElem.innerText = await globals.translate("forgotPassword");
      this.needAccountElem.innerText = await globals.translate("needAccount");
      this.createAccountElem.text = await globals.translate("createAccount");
      this.playerLoginTextElem.innerText = await globals.translate("playerLogin");
      this.playerLoginTextElem.style.fontSize = `${Math.min(646 / this.playerLoginTextElem.innerText.length, 36)}px`;
    }

    // --- Tester Logic Methods (Moved to tester-logic.js) ---

    // --- Tester UI Methods (Moved to tester-ui.js) ---

  });
})();
