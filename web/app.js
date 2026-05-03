const DEFAULT_APP_THRESHOLDS = [
  { min: 1, max: 4, title: "Tier 1", color: [0.31, 0.49, 0.39], hex: "#4f7d63" },
  { min: 5, max: 9, title: "Tier 2", color: [0.83, 0.61, 0.17], hex: "#d39b2b" },
  { min: 10, max: 14, title: "Email Home", color: [0.73, 0.38, 0.33], hex: "#b96253" },
  { min: 15, max: 9999, title: "Tier 4", color: [0.09, 0.2, 0.3], hex: "#17324d" }
];

const PROFILE_CONFIGS = {
  "avon-tardies": {
    profileId: "avon-tardies",
    defaultSchoolName: "Avon North Middle School",
    appTitle: "Tardy Tracker",
    countLabel: "Total tardies",
    incidentSingular: "tardy",
    incidentPlural: "tardies",
    showTeam: true
  },
  "brownsburg-high-lanyards": {
    profileId: "brownsburg-high-lanyards",
    defaultSchoolName: "Brownsburg High School",
    appTitle: "Lanyard Tracker",
    countLabel: "Total lanyard violations",
    incidentSingular: "lanyard violation",
    incidentPlural: "lanyard violations",
    showTeam: false,
    defaultThresholds: [
      { min: 1, max: 4, title: "Tier 1", color: [0.7, 1, 0.7] },
      { min: 5, max: 9, title: "Tier 2", color: [1, 1, 0.6] },
      { min: 10, max: 14, title: "Tier 3", color: [1, 0.8, 0.5] },
      { min: 15, max: 9999, title: "Tier 4", color: [1, 0.6, 0.6] }
    ]
  },
  "brownsburg-high-tardies": {
    profileId: "brownsburg-high-tardies",
    defaultSchoolName: "Brownsburg High School",
    appTitle: "Tardy Tracker",
    countLabel: "Total tardies",
    incidentSingular: "tardy",
    incidentPlural: "tardies",
    showTeam: false
  }
};

const RUNTIME_CONFIG = resolveRuntimeConfig();
const STORAGE_KEY = `lanyard-mobile-shell-v3:${RUNTIME_CONFIG.profileId}`;
const MAX_RECENT_SCANS = 12;
const ASSET_VERSION = "20260503a";
const APPS_SCRIPT_JSONP_TIMEOUT_MS = 20000;

const sampleStudents = {
  "1001": {
    student_id: "1001",
    first_name: "Avery",
    last_name: "Cole",
    class_year: "7",
    team: "Harbor",
    parent_email: "avery-family@example.com"
  },
  "1002": {
    student_id: "1002",
    first_name: "Jordan",
    last_name: "Reyes",
    class_year: "8",
    team: "Summit",
    parent_email: "jordan-family@example.com"
  },
  "1003": {
    student_id: "1003",
    first_name: "Morgan",
    last_name: "Lee",
    class_year: "6",
    team: "Canyon",
    parent_email: "morgan-family@example.com"
  }
};

const defaultState = {
  schoolName: RUNTIME_CONFIG.defaultSchoolName,
  appTitle: RUNTIME_CONFIG.appTitle,
  countLabel: RUNTIME_CONFIG.countLabel,
  incidentSingular: RUNTIME_CONFIG.incidentSingular,
  incidentPlural: RUNTIME_CONFIG.incidentPlural,
  apiBase: sanitizeBaseUrl(RUNTIME_CONFIG.defaultApiBase || ""),
  adminKey: "",
  backendConnected: false,
  currentSection: 1,
  emailHomeEnabled: typeof RUNTIME_CONFIG.defaultEmailHomeEnabled === "boolean" ? RUNTIME_CONFIG.defaultEmailHomeEnabled : true,
  lastResetTime: "Never",
  studentTotals: { "1001": 3, "1002": 8, "1003": 1 },
  scannedKeys: {},
  recentScans: [],
  pendingEmails: [],
  queue: [],
  localStudents: {},
  lastStudent: null,
  thresholds: normalizeThresholds(RUNTIME_CONFIG.defaultThresholds || DEFAULT_APP_THRESHOLDS)
};

const state = loadState();
const elements = {
  form: document.getElementById("scanForm"),
  studentId: document.getElementById("studentId"),
  manualScanBtn: document.getElementById("manualScanBtn"),
  addStudentOpenBtn: document.getElementById("addStudentOpenBtn"),
  scanMessage: document.getElementById("scanMessage"),
  brandEyebrow: document.getElementById("brandEyebrow"),
  brandTitle: document.getElementById("brandTitle"),
  settingsOpenBtn: document.getElementById("settingsOpenBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsCloseBtn: document.getElementById("settingsCloseBtn"),
  settingsLockBadge: document.getElementById("settingsLockBadge"),
  settingsMessage: document.getElementById("settingsMessage"),
  adminUnlockInput: document.getElementById("adminUnlockInput"),
  unlockSettingsBtn: document.getElementById("unlockSettingsBtn"),
  lockSettingsBtn: document.getElementById("lockSettingsBtn"),
  adminSettingsPanel: document.getElementById("adminSettingsPanel"),
  queueCount: document.getElementById("queueCount"),
  sectionCount: document.getElementById("sectionCount"),
  resetBadge: document.getElementById("resetBadge"),
  modeBadge: document.getElementById("modeBadge"),
  recentScans: document.getElementById("recentScans"),
  pendingEmails: document.getElementById("pendingEmails"),
  thresholdList: document.getElementById("thresholdList"),
  addThresholdBtn: document.getElementById("addThresholdBtn"),
  saveThresholdsBtn: document.getElementById("saveThresholdsBtn"),
  studentEmpty: document.getElementById("studentEmpty"),
  studentDetail: document.getElementById("studentDetail"),
  studentName: document.getElementById("studentName"),
  studentTeamCard: document.getElementById("studentTeamCard"),
  studentTeam: document.getElementById("studentTeam"),
  studentYear: document.getElementById("studentYear"),
  studentCountLabel: document.getElementById("studentCountLabel"),
  studentCountCard: document.getElementById("studentCountCard"),
  studentCount: document.getElementById("studentCount"),
  studentThresholdCard: document.getElementById("studentThresholdCard"),
  studentThreshold: document.getElementById("studentThreshold"),
  emailHomeToggle: document.getElementById("emailHomeToggle"),
  apiBaseInput: document.getElementById("apiBaseInput"),
  adminKeyInput: document.getElementById("adminKeyInput"),
  newSectionBtn: document.getElementById("newSectionBtn"),
  syncBtn: document.getElementById("syncBtn"),
  refreshBackendBtn: document.getElementById("refreshBackendBtn"),
  queueEmailBtn: document.getElementById("queueEmailBtn"),
  sendEmailBtn: document.getElementById("sendEmailBtn"),
  reviewPendingBtn: document.getElementById("reviewPendingBtn"),
  clearPendingBtn: document.getElementById("clearPendingBtn"),
  addStudentModal: document.getElementById("addStudentModal"),
  addStudentForm: document.getElementById("addStudentForm"),
  addStudentCloseBtn: document.getElementById("addStudentCloseBtn"),
  addStudentMessage: document.getElementById("addStudentMessage"),
  addStudentTeamField: document.getElementById("addStudentTeamField"),
  addStudentStudentId: document.getElementById("addStudentStudentId"),
  addStudentFirstName: document.getElementById("addStudentFirstName"),
  addStudentLastName: document.getElementById("addStudentLastName"),
  addStudentClassYear: document.getElementById("addStudentClassYear"),
  addStudentTeam: document.getElementById("addStudentTeam"),
  addStudentParentEmail: document.getElementById("addStudentParentEmail"),
  addStudentSubmitBtn: document.getElementById("addStudentSubmitBtn"),
  pendingReviewModal: document.getElementById("pendingReviewModal"),
  pendingReviewCloseBtn: document.getElementById("pendingReviewCloseBtn"),
  pendingReviewMessage: document.getElementById("pendingReviewMessage"),
  pendingReviewList: document.getElementById("pendingReviewList"),
  emailComposerModal: document.getElementById("emailComposerModal"),
  emailComposerCloseBtn: document.getElementById("emailComposerCloseBtn"),
  emailComposerForm: document.getElementById("emailComposerForm"),
  emailComposerTo: document.getElementById("emailComposerTo"),
  emailComposerSubject: document.getElementById("emailComposerSubject"),
  emailComposerBody: document.getElementById("emailComposerBody"),
  emailComposerMessage: document.getElementById("emailComposerMessage"),
  emailComposerSendBtn: document.getElementById("emailComposerSendBtn"),
  cameraScanBtn: document.getElementById("cameraScanBtn"),
  scannerModal: document.getElementById("scannerModal"),
  scannerMount: document.getElementById("scannerMount"),
  scannerStatus: document.getElementById("scannerStatus"),
  scannerCloseBtn: document.getElementById("scannerCloseBtn")
};
const scannerState = {
  instance: null,
  active: false,
  opening: false,
  resolving: false
};
const uiState = {
  settingsOpen: false,
  settingsUnlocked: false,
  addStudentOpen: false,
  addStudentSaving: false,
  pendingReviewOpen: false,
  emailComposerOpen: false,
  emailComposerSending: false,
  emailComposerItem: null
};
const submissionState = {
  inFlight: false
};

init().catch((error) => {
  showMessage(error.message || "Unable to initialize the app.");
});

async function init() {
  wireEvents();
  render();
  if (state.apiBase) {
    await bootstrapFromApi();
  }
  registerServiceWorker();
}

function wireEvents() {
  elements.form.addEventListener("submit", handleScan);
  elements.addStudentOpenBtn.addEventListener("click", openAddStudentModal);
  elements.settingsOpenBtn.addEventListener("click", openSettings);
  elements.settingsCloseBtn.addEventListener("click", closeSettings);
  elements.unlockSettingsBtn.addEventListener("click", handleSettingsUnlock);
  elements.lockSettingsBtn.addEventListener("click", handleSettingsLock);
  elements.newSectionBtn.addEventListener("click", handleNewSection);
  elements.syncBtn.addEventListener("click", handleSync);
  elements.refreshBackendBtn.addEventListener("click", bootstrapFromApi);
  elements.queueEmailBtn.addEventListener("click", handleQueueEmail);
  elements.sendEmailBtn.addEventListener("click", handleSendEmail);
  elements.reviewPendingBtn.addEventListener("click", openPendingReviewModal);
  elements.clearPendingBtn.addEventListener("click", handleClearPending);
  elements.addStudentForm.addEventListener("submit", handleAddStudentSubmit);
  elements.addStudentCloseBtn.addEventListener("click", closeAddStudentModal);
  elements.pendingReviewCloseBtn.addEventListener("click", closePendingReviewModal);
  elements.pendingReviewList.addEventListener("click", handlePendingReviewListClick);
  elements.emailComposerCloseBtn.addEventListener("click", () => closeEmailComposer());
  elements.emailComposerForm.addEventListener("submit", handleEmailComposerSubmit);
  elements.addThresholdBtn.addEventListener("click", handleAddThreshold);
  elements.saveThresholdsBtn.addEventListener("click", handleSaveThresholds);
  elements.thresholdList.addEventListener("change", handleThresholdEditorChange);
  elements.thresholdList.addEventListener("click", handleThresholdListClick);
  elements.cameraScanBtn.addEventListener("click", openScanner);
  elements.scannerCloseBtn.addEventListener("click", () => closeScanner());
  elements.settingsModal.addEventListener("click", (event) => {
    if (event.target === elements.settingsModal) {
      closeSettings();
    }
  });
  elements.addStudentModal.addEventListener("click", (event) => {
    if (event.target === elements.addStudentModal) {
      closeAddStudentModal();
    }
  });
  elements.pendingReviewModal.addEventListener("click", (event) => {
    if (event.target === elements.pendingReviewModal) {
      closePendingReviewModal();
    }
  });
  elements.emailComposerModal.addEventListener("click", (event) => {
    if (event.target === elements.emailComposerModal) {
      closeEmailComposer();
    }
  });
  elements.scannerModal.addEventListener("click", (event) => {
    if (event.target === elements.scannerModal) {
      closeScanner();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.scannerModal.hidden) {
      closeScanner();
      return;
    }
    if (event.key === "Escape" && !elements.emailComposerModal.hidden) {
      closeEmailComposer();
      return;
    }
    if (event.key === "Escape" && !elements.pendingReviewModal.hidden) {
      closePendingReviewModal();
      return;
    }
    if (event.key === "Escape" && !elements.addStudentModal.hidden) {
      closeAddStudentModal();
      return;
    }
    if (event.key === "Escape" && !elements.settingsModal.hidden) {
      closeSettings();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !elements.scannerModal.hidden) {
      closeScanner();
    }
  });

  elements.emailHomeToggle.addEventListener("change", async () => {
    if (!state.apiBase) {
      state.emailHomeEnabled = elements.emailHomeToggle.checked;
      persist();
      render();
      return;
    }

    try {
      const settings = await apiFetch("/api/settings/email-home", {
        method: "POST",
        body: JSON.stringify({ enabled: elements.emailHomeToggle.checked })
      }, { admin: true });
      applySettings(settings);
      render();
      showMessage(`Email-home is now ${state.emailHomeEnabled ? "on" : "off"}.`);
    } catch (error) {
      elements.emailHomeToggle.checked = state.emailHomeEnabled;
      showMessage(error.message);
    }
  });

  elements.apiBaseInput.addEventListener("change", async () => {
    state.apiBase = sanitizeBaseUrl(elements.apiBaseInput.value);
    state.backendConnected = false;
    persist();
    render();

    if (state.apiBase) {
      await bootstrapFromApi();
    } else {
      showMessage("API cleared. The app is back in mock mode.");
    }
  });

  elements.adminKeyInput.addEventListener("change", () => {
    state.adminKey = elements.adminKeyInput.value.trim();
    elements.adminUnlockInput.value = state.adminKey;
    persist();
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeStoredState(clone(defaultState));
    }
    return normalizeStoredState({
      ...clone(defaultState),
      ...JSON.parse(raw)
    });
  } catch {
    return normalizeStoredState(clone(defaultState));
  }
}

function persist() {
  state.scannedKeys = pruneScannedKeys(state.scannedKeys);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderBrand() {
  const schoolName = String(state.schoolName || defaultState.schoolName || "School").trim();
  const appTitle = String(state.appTitle || defaultState.appTitle || "Lanyard Tracker").trim();
  const countLabel = String(state.countLabel || defaultState.countLabel || "Total violations").trim();
  elements.brandEyebrow.textContent = schoolName;
  elements.brandTitle.textContent = appTitle;
  elements.studentCountLabel.textContent = countLabel;
  document.title = `${schoolName} ${appTitle}`;
}

function render() {
  state.scannedKeys = pruneScannedKeys(state.scannedKeys);
  renderBrand();
  elements.queueCount.textContent = String(state.queue.length);
  elements.sectionCount.textContent = String(state.currentSection || 1);
  elements.resetBadge.textContent = formatResetTime(state.lastResetTime);
  elements.modeBadge.textContent = state.apiBase ? (state.backendConnected ? "Connected" : "Configured") : "Mock mode";
  elements.settingsLockBadge.textContent = uiState.settingsUnlocked ? "Unlocked" : "Locked";
  elements.settingsLockBadge.classList.toggle("unlocked", uiState.settingsUnlocked);
  elements.adminSettingsPanel.hidden = !uiState.settingsUnlocked;
  elements.emailHomeToggle.checked = Boolean(state.emailHomeEnabled);
  elements.apiBaseInput.value = state.apiBase;
  elements.adminKeyInput.value = state.adminKey;
  elements.adminUnlockInput.value = state.adminKey;
  elements.queueEmailBtn.disabled = !state.lastStudent;
  elements.sendEmailBtn.disabled = !state.lastStudent || !state.lastStudent.parent_email;
  elements.reviewPendingBtn.disabled = false;
  updateScanControls();
  renderAddStudentForm();
  renderStudent();
  renderRecentScans();
  renderPendingEmails();
  renderPendingReviewList();
  renderEmailComposer();
  renderThresholds();
}

function renderStudent() {
  if (!state.lastStudent) {
    elements.studentEmpty.hidden = false;
    elements.studentDetail.hidden = true;
    if (elements.studentTeamCard) {
      elements.studentTeamCard.hidden = false;
    }
    clearTierHighlight(elements.studentCountCard);
    clearTierHighlight(elements.studentThresholdCard);
    return;
  }

  elements.studentEmpty.hidden = true;
  elements.studentDetail.hidden = false;
  elements.studentName.textContent = `${state.lastStudent.first_name} ${state.lastStudent.last_name}`;
  if (elements.studentTeamCard) {
    elements.studentTeamCard.hidden = !shouldShowTeamField(state.lastStudent);
  }
  elements.studentTeam.textContent = state.lastStudent.team || "";
  elements.studentYear.textContent = state.lastStudent.class_year || "Unknown";
  elements.studentCount.textContent = String(state.lastStudent.total_count || 0);
  elements.studentThreshold.textContent = (state.lastStudent.threshold && state.lastStudent.threshold.title) || "Unknown";
  applyStudentTierHighlight(state.lastStudent.threshold);
}

function shouldShowTeamField(student) {
  if (RUNTIME_CONFIG.showTeam === false) {
    return false;
  }
  return Boolean(student && String(student.team || "").trim());
}

function applyStudentTierHighlight(threshold) {
  if (!threshold || !threshold.hex) {
    clearTierHighlight(elements.studentCountCard);
    clearTierHighlight(elements.studentThresholdCard);
    return;
  }

  applyTierHighlight(elements.studentCountCard, threshold.hex);
  applyTierHighlight(elements.studentThresholdCard, threshold.hex);
}

function applyTierHighlight(card, hex) {
  const safeHex = normalizeHexColor(hex);
  const textColor = textColorForHex(safeHex);
  card.classList.add("tier-highlight");
  card.style.backgroundColor = safeHex;
  card.style.color = textColor;
  card.style.borderColor = "rgba(23, 50, 77, 0.16)";
  card.querySelectorAll("span, strong").forEach((node) => {
    node.style.color = textColor;
  });
}

function clearTierHighlight(card) {
  card.classList.remove("tier-highlight");
  card.style.backgroundColor = "";
  card.style.color = "";
  card.style.borderColor = "";
  card.querySelectorAll("span, strong").forEach((node) => {
    node.style.color = "";
  });
}

function renderRecentScans() {
  const countLabel = String(state.countLabel || defaultState.countLabel || "Total violations").trim();
  const items = state.recentScans.map((scan) => `
    <li>
      <strong>${escapeHtml(scan.name)}</strong>
      <small>${escapeHtml(formatRecentScanIdentity(scan))}</small>
      <small>${escapeHtml(countLabel)} ${escapeHtml(String(scan.total_count || 0))} | Section ${escapeHtml(String(scan.section || 1))} | ${escapeHtml(scan.synced ? "Synced" : "Queued")}</small>
    </li>
  `).join("");
  elements.recentScans.innerHTML = items || `<li><strong>No scans yet.</strong><small>Use the scan box above to start.</small></li>`;
}

function renderPendingEmails() {
  const items = state.pendingEmails.map((item) => `
    <li>
      <strong>${escapeHtml(item.name || "Unknown student")}</strong>
      <small>${escapeHtml(item.parent_email || item.email || "No parent email on file")}</small>
      <small>${escapeHtml(item.reason || `${item.tier || "Pending review"}`)}</small>
    </li>
  `).join("");
  elements.pendingEmails.innerHTML = items || `<li><strong>No pending emails.</strong><small>Email-home triggers will appear here.</small></li>`;
}

function renderPendingReviewList() {
  const items = state.pendingEmails.map((item, index) => {
    const pending = normalizePendingEmailItem(item, index);
    return `
      <li data-student-id="${escapeAttribute(pending.student_id)}">
        <div class="review-item-head">
          <strong>${escapeHtml(pending.name || "Unknown student")}</strong>
          <span class="review-item-badge">${escapeHtml(pending.tier || "Pending review")}</span>
        </div>
        <div class="review-item-meta">
          <small>${escapeHtml(pending.parent_email || "No parent email on file")}</small>
          <small>${escapeHtml(String(pending.total_count))} ${escapeHtml(state.incidentPlural || defaultState.incidentPlural)}</small>
        </div>
        <small>${escapeHtml(pending.reason || "Queued for parent follow-up.")}</small>
        <div class="review-item-actions">
          <button class="ghost" type="button" data-action="view-pending" data-student-id="${escapeAttribute(pending.student_id)}">View</button>
          <button class="ghost" type="button" data-action="send-pending" data-student-id="${escapeAttribute(pending.student_id)}" ${pending.parent_email ? "" : "disabled"}>Send</button>
          <button class="ghost danger-button" type="button" data-action="delete-pending" data-student-id="${escapeAttribute(pending.student_id)}">Delete</button>
        </div>
      </li>
    `;
  }).join("");

  elements.pendingReviewList.innerHTML = items || `<li><strong>No pending emails.</strong><small>Email-home triggers will appear here.</small></li>`;
  elements.pendingReviewMessage.textContent = state.pendingEmails.length > 0
    ? `There ${state.pendingEmails.length === 1 ? "is" : "are"} ${state.pendingEmails.length} pending parent email${state.pendingEmails.length === 1 ? "" : "s"}.`
    : "Review and send queued parent emails.";
}

function renderEmailComposer() {
  const draft = uiState.emailComposerItem;
  const isSending = uiState.emailComposerSending;
  elements.emailComposerTo.disabled = isSending;
  elements.emailComposerSubject.disabled = isSending;
  elements.emailComposerBody.disabled = isSending;
  elements.emailComposerSendBtn.disabled = isSending;
  elements.emailComposerCloseBtn.disabled = isSending;

  if (!draft) {
    elements.emailComposerForm.reset();
    elements.emailComposerMessage.textContent = "Review the email before sending it.";
    return;
  }

  elements.emailComposerTo.value = draft.to || "";
  elements.emailComposerSubject.value = draft.subject || "";
  elements.emailComposerBody.value = draft.body || "";
  elements.emailComposerMessage.textContent = draft.to
    ? `Ready to send to ${draft.to}.`
    : "This student does not have a parent email on file yet.";
}

function renderThresholds() {
  elements.thresholdList.innerHTML = state.thresholds.map((threshold, index) => {
    const normalized = normalizeThresholdDraft(threshold, index);
    const hex = normalized.hex;
    const incidentPlural = String(state.incidentPlural || defaultState.incidentPlural || "violations");
    const previewLabel = `${normalized.min} to ${normalized.max} ${incidentPlural}`;
    return `
      <div class="threshold-item" data-index="${index}">
        <div class="threshold-item-head">
          <div>
            <strong>${escapeHtml(normalized.title)}</strong>
            <div class="helper">${escapeHtml(previewLabel)}</div>
          </div>
          <button class="ghost threshold-remove-btn" type="button" data-action="remove-threshold" data-index="${index}" ${state.thresholds.length === 1 ? "disabled" : ""}>Remove</button>
        </div>
        <div class="threshold-item-grid">
          <label class="stack-field">
            <span>Title</span>
            <input type="text" data-field="title" value="${escapeAttribute(normalized.title)}" />
          </label>
          <label class="stack-field">
            <span>Min</span>
            <input type="number" min="0" step="1" data-field="min" value="${escapeAttribute(String(normalized.min))}" />
          </label>
          <label class="stack-field">
            <span>Max</span>
            <input type="number" min="0" step="1" data-field="max" value="${escapeAttribute(String(normalized.max))}" />
          </label>
          <label class="stack-field">
            <span>Color</span>
            <input class="threshold-color-input" type="color" data-field="hex" value="${escapeAttribute(hex)}" />
          </label>
        </div>
        <div class="threshold-item-preview">
          <small>${escapeHtml(previewLabel)}</small>
          <span class="threshold-pill" style="background:${hex};color:${textColorForHex(hex)}">${escapeHtml(normalized.title)}</span>
        </div>
      </div>
    `;
  }).join("") || `<div class="threshold-item"><strong>No tiers yet.</strong><small>Add a tier to start.</small></div>`;
}

function normalizeThresholdDraft(threshold, index = 0) {
  const hex = normalizeHexColor(threshold.hex || rgbArrayToHex(threshold.color || [1, 1, 1]));
  return {
    title: String(threshold.title || `Tier ${index + 1}`).trim() || `Tier ${index + 1}`,
    min: Number(threshold.min),
    max: Number(threshold.max),
    hex: hex,
    color: hexToRgbArray(hex)
  };
}

function readThresholdsFromEditor() {
  const rows = Array.from(elements.thresholdList.querySelectorAll(".threshold-item[data-index]"));
  return rows.map((row, index) => normalizeThresholdDraft({
    title: row.querySelector('[data-field="title"]').value,
    min: row.querySelector('[data-field="min"]').value,
    max: row.querySelector('[data-field="max"]').value,
    hex: row.querySelector('[data-field="hex"]').value
  }, index));
}

function syncThresholdsFromEditor() {
  if (!elements.thresholdList.querySelector(".threshold-item[data-index]")) {
    return state.thresholds;
  }

  state.thresholds = readThresholdsFromEditor();
  refreshLastStudentThreshold();
  return state.thresholds;
}

function refreshLastStudentThreshold() {
  if (!state.lastStudent || !Number.isFinite(Number(state.lastStudent.total_count))) {
    return;
  }

  state.lastStudent.threshold = thresholdFor(Number(state.lastStudent.total_count));
}

function validateThresholds(thresholds) {
  if (!thresholds.length) {
    throw new Error("Add at least one tier.");
  }

  return thresholds.map((threshold, index) => {
    const normalized = normalizeThresholdDraft(threshold, index);
    if (!normalized.title) {
      throw new Error(`Tier ${index + 1} needs a title.`);
    }
    if (!Number.isFinite(normalized.min) || !Number.isFinite(normalized.max)) {
      throw new Error(`Tier ${index + 1} needs valid min and max values.`);
    }
    if (normalized.max < normalized.min) {
      throw new Error(`Tier ${index + 1} has a max lower than its min.`);
    }
    if (index > 0 && normalized.min <= Number(thresholds[index - 1].max)) {
      throw new Error(`Tier ${index + 1} overlaps the previous tier.`);
    }

    return {
      ...normalized,
      min: Math.trunc(normalized.min),
      max: Math.trunc(normalized.max)
    };
  });
}

function handleThresholdEditorChange() {
  syncThresholdsFromEditor();
  persist();
  render();
}

function handleThresholdListClick(event) {
  const removeButton = event.target.closest('[data-action="remove-threshold"]');
  if (!removeButton) {
    return;
  }

  syncThresholdsFromEditor();
  const index = Number(removeButton.dataset.index);
  if (!Number.isFinite(index) || state.thresholds.length <= 1) {
    return;
  }

  state.thresholds.splice(index, 1);
  refreshLastStudentThreshold();
  persist();
  render();
}

function handleAddThreshold() {
  syncThresholdsFromEditor();
  const lastThreshold = state.thresholds[state.thresholds.length - 1];
  const nextMin = Number.isFinite(Number(lastThreshold && lastThreshold.max)) ? Number(lastThreshold.max) + 1 : 1;
  state.thresholds.push(normalizeThresholdDraft({
    title: `Tier ${state.thresholds.length + 1}`,
    min: nextMin,
    max: nextMin + 4,
    hex: "#8c9aa8"
  }, state.thresholds.length));
  persist();
  render();
}

async function handleSaveThresholds() {
  try {
    const nextThresholds = validateThresholds(syncThresholdsFromEditor());
    if (!state.apiBase) {
      state.thresholds = normalizeThresholds(nextThresholds);
      refreshLastStudentThreshold();
      persist();
      render();
      showSettingsMessage("Thresholds saved in this browser.");
      return;
    }

    const savedThresholds = await apiFetch("/api/thresholds", {
      method: "POST",
      body: JSON.stringify({ thresholds: nextThresholds })
    }, { admin: true });
    state.thresholds = normalizeThresholds(savedThresholds);
    refreshLastStudentThreshold();
    persist();
    render();
    showSettingsMessage("Thresholds saved.");
  } catch (error) {
    showSettingsMessage(error.message);
  }
}

function normalizeStoredState(nextState) {
  return {
    ...nextState,
    schoolName: String(nextState.schoolName || defaultState.schoolName),
    appTitle: String(nextState.appTitle || defaultState.appTitle),
    countLabel: String(nextState.countLabel || defaultState.countLabel),
    incidentSingular: String(nextState.incidentSingular || defaultState.incidentSingular),
    incidentPlural: String(nextState.incidentPlural || defaultState.incidentPlural),
    apiBase: resolveStoredApiBase(nextState.apiBase),
    localStudents: normalizeStudentDirectory(nextState.localStudents || {}),
    thresholds: normalizeThresholds(nextState.thresholds || defaultState.thresholds),
    scannedKeys: pruneScannedKeys(nextState.scannedKeys)
  };
}

function resolveStoredApiBase(storedApiBase) {
  const saved = sanitizeBaseUrl(storedApiBase || "");
  const configuredDefault = sanitizeBaseUrl(defaultState.apiBase || "");
  if (RUNTIME_CONFIG.forceDefaultApiBase && configuredDefault) {
    return configuredDefault;
  }
  return saved || configuredDefault;
}

function formatRecentScanIdentity(scan) {
  const studentId = String(scan.student_id || "").trim();
  const team = String(scan.team || "").trim();
  return team ? `${studentId} | ${team}` : studentId;
}

function pruneScannedKeys(scannedKeys = {}) {
  const activeDay = `${todayKey()}:`;
  return Object.entries(scannedKeys).reduce((next, [key, value]) => {
    if (String(key).startsWith(activeDay) && value) {
      next[key] = true;
    }
    return next;
  }, {});
}

function normalizeStudentIdKey(value) {
  const normalized = String(value || "").trim().replace(/^0+/, "");
  return normalized || "0";
}

function normalizeStudentIdValue(value) {
  return String(value || "").trim().replace(/^0+/, "");
}

function normalizeStudentRecord(student = {}) {
  return {
    student_id: normalizeStudentIdValue(student.student_id || student.studentId || ""),
    first_name: String(student.first_name || student.firstName || "").trim(),
    last_name: String(student.last_name || student.lastName || "").trim(),
    class_year: String(student.class_year || student.classYear || "").trim(),
    team: String(student.team || "").trim(),
    parent_email: String(student.parent_email || student.parentEmail || student.email || "").trim()
  };
}

function splitStudentName(fullName = "") {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first_name: "", last_name: "" };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ")
  };
}

function normalizePendingEmailItem(item = {}, index = 0) {
  const rawName = String(item.name || "").trim();
  const parsedName = splitStudentName(rawName);
  const studentId = normalizeStudentIdValue(item.student_id || item.studentId || item.id || `pending-${index + 1}`);
  const totalCount = Number(item.total_count || item.totalCount || 0);
  const tier = String(item.tier || item.threshold || "Email Home").trim() || "Email Home";
  return {
    student_id: studentId,
    name: rawName || `${parsedName.first_name} ${parsedName.last_name}`.trim(),
    first_name: String(item.first_name || parsedName.first_name || "").trim(),
    last_name: String(item.last_name || parsedName.last_name || "").trim(),
    parent_email: String(item.parent_email || item.parentEmail || item.email || "").trim(),
    total_count: Number.isFinite(totalCount) ? totalCount : 0,
    tier,
    reason: String(item.reason || "").trim(),
    status: String(item.status || "pending").trim()
  };
}

function buildPendingEmailDraft(item) {
  const pending = normalizePendingEmailItem(item);
  const fullName = `${pending.first_name} ${pending.last_name}`.trim() || pending.name || "Student";
  const totalCount = Number(pending.total_count || 0);
  const tierTitle = pending.tier || "Email Home";
  const appTitle = String(state.appTitle || defaultState.appTitle || "Tracker").trim();
  const schoolName = String(state.schoolName || defaultState.schoolName || "School").trim();
  const subject = `${fullName} ${appTitle} Notice (${totalCount} total ${state.incidentPlural || defaultState.incidentPlural})`;

  if (/tardy/i.test(appTitle) || /\btard(?:y|ies)\b/i.test(`${state.incidentSingular} ${state.incidentPlural}`)) {
    const sweepLabel = `${totalCount} tardy sweep${totalCount === 1 ? "" : "s"}`;
    return {
      pending,
      to: pending.parent_email,
      subject,
      body: [
        "Good afternoon,",
        "",
        `This message is to inform you that ${fullName} has been caught in ${sweepLabel}.`,
        `This places them in the ${tierTitle} tier of our tardy tracker.`,
        "",
        "Thank you,",
        `${schoolName} Administration`
      ].join("\n")
    };
  }

  return {
    pending,
    to: pending.parent_email,
    subject,
    body: [
      "Good afternoon,",
      "",
      `This message is to inform you that ${fullName} has reached ${totalCount} recorded ${state.incidentPlural || defaultState.incidentPlural} in our system.`,
      `This places them in the ${tierTitle} tier of our ${(appTitle || "tracker").toLowerCase()}.`,
      "",
      "Thank you,",
      `${schoolName} Administration`
    ].join("\n")
  };
}

function normalizeStudentDirectory(directory = {}) {
  return Object.values(directory).reduce((next, student) => {
    const normalized = normalizeStudentRecord(student);
    if (normalized.student_id) {
      next[normalized.student_id] = normalized;
    }
    return next;
  }, {});
}

function readAddStudentForm() {
  return normalizeStudentRecord({
    student_id: elements.addStudentStudentId.value,
    first_name: elements.addStudentFirstName.value,
    last_name: elements.addStudentLastName.value,
    class_year: elements.addStudentClassYear.value,
    team: elements.addStudentTeam.value,
    parent_email: elements.addStudentParentEmail.value
  });
}

function validateStudentRecord(student) {
  const normalized = normalizeStudentRecord(student);
  if (!normalized.student_id) {
    throw new Error("Student ID is required.");
  }
  if (!normalized.first_name) {
    throw new Error("First name is required.");
  }
  if (!normalized.last_name) {
    throw new Error("Last name is required.");
  }
  if (!normalized.class_year) {
    throw new Error("Class year is required.");
  }
  if (normalized.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.parent_email)) {
    throw new Error("Enter a valid parent email or leave it blank.");
  }
  if (RUNTIME_CONFIG.showTeam === false) {
    normalized.team = "";
  }
  return normalized;
}

function findStudentById(studentId) {
  const normalizedStudentId = normalizeStudentIdKey(studentId);
  return state.localStudents[normalizedStudentId] || sampleStudents[normalizedStudentId] || null;
}

function makeScanKey(studentId, section = state.currentSection, dayKey = todayKey()) {
  return `${dayKey}:${Number(section || 1)}:${normalizeStudentIdKey(studentId)}`;
}

function hasLocalDuplicateScan(studentId, section = state.currentSection) {
  return Boolean(state.scannedKeys[makeScanKey(studentId, section)]);
}

function rememberLocalScan(studentId, section = state.currentSection) {
  state.scannedKeys[makeScanKey(studentId, section)] = true;
}

function updateScanControls() {
  elements.studentId.disabled = submissionState.inFlight;
  elements.manualScanBtn.disabled = submissionState.inFlight;
  elements.addStudentOpenBtn.disabled = submissionState.inFlight;
  elements.cameraScanBtn.disabled = submissionState.inFlight;
}

function setScanBusy(isBusy) {
  submissionState.inFlight = isBusy;
  updateScanControls();
}

function renderAddStudentForm() {
  if (elements.addStudentTeamField) {
    elements.addStudentTeamField.hidden = RUNTIME_CONFIG.showTeam === false;
  }
  updateAddStudentControls();
}

function updateAddStudentControls() {
  const isSaving = uiState.addStudentSaving;
  elements.addStudentStudentId.disabled = isSaving;
  elements.addStudentFirstName.disabled = isSaving;
  elements.addStudentLastName.disabled = isSaving;
  elements.addStudentClassYear.disabled = isSaving;
  elements.addStudentTeam.disabled = isSaving;
  elements.addStudentParentEmail.disabled = isSaving;
  elements.addStudentSubmitBtn.disabled = isSaving;
  elements.addStudentCloseBtn.disabled = isSaving;
}

function openAddStudentModal() {
  uiState.addStudentOpen = true;
  uiState.addStudentSaving = false;
  resetAddStudentForm(elements.studentId.value.trim());
  elements.addStudentModal.hidden = false;
  document.body.classList.add("student-entry-open");
  elements.addStudentStudentId.focus();
}

function closeAddStudentModal(force = false) {
  if (uiState.addStudentSaving && !force) {
    return;
  }

  uiState.addStudentOpen = false;
  elements.addStudentModal.hidden = true;
  document.body.classList.remove("student-entry-open");
}

async function openPendingReviewModal() {
  uiState.pendingReviewOpen = true;
  elements.pendingReviewModal.hidden = false;
  document.body.classList.add("pending-review-open");
  renderPendingReviewList();

  if (!state.apiBase) {
    return;
  }

  elements.pendingReviewMessage.textContent = "Checking Google Sheets for pending parent emails...";
  try {
    await refreshPendingEmails();
    persist();
    renderPendingReviewList();
  } catch (error) {
    const message = error.message || "Unable to refresh pending emails.";
    elements.pendingReviewMessage.textContent = message;
    showMessage(message);
  }
}

function closePendingReviewModal() {
  uiState.pendingReviewOpen = false;
  elements.pendingReviewModal.hidden = true;
  document.body.classList.remove("pending-review-open");
}

function openEmailComposer(item) {
  uiState.emailComposerItem = buildPendingEmailDraft(item);
  uiState.emailComposerOpen = true;
  uiState.emailComposerSending = false;
  elements.emailComposerModal.hidden = false;
  document.body.classList.add("email-composer-open");
  renderEmailComposer();
  elements.emailComposerTo.focus();
}

function closeEmailComposer(force = false) {
  if (uiState.emailComposerSending && !force) {
    return;
  }
  uiState.emailComposerOpen = false;
  uiState.emailComposerSending = false;
  uiState.emailComposerItem = null;
  elements.emailComposerModal.hidden = true;
  document.body.classList.remove("email-composer-open");
  renderEmailComposer();
}

function resetAddStudentForm(seedStudentId = "") {
  elements.addStudentForm.reset();
  elements.addStudentStudentId.value = seedStudentId ? normalizeStudentIdKey(seedStudentId) : "";
  showAddStudentMessage(
    state.apiBase
      ? "Add a student to the connected roster."
      : "Add a student locally. They will be available only in this browser until a backend is configured."
  );
  renderAddStudentForm();
}

function showAddStudentMessage(message) {
  elements.addStudentMessage.textContent = message;
}

function formatAddStudentError(error) {
  const message = String(error && error.message ? error.message : "").trim();
  if (isAppsScriptBackend() && message === "Student not found.") {
    return "This Google Apps Script is still on the old version. Paste the latest Code.gs into Apps Script, redeploy the web app, then try Add student again.";
  }
  if (message === "Admin key is missing or incorrect.") {
    return "The saved admin key in this app does not match the ADMIN_KEY in Apps Script. Re-enter it in Admin settings and try again.";
  }
  return message || "Unable to add the student.";
}

function openSettings() {
  uiState.settingsOpen = true;
  elements.settingsModal.hidden = false;
  document.body.classList.add("settings-open");
  if (!uiState.settingsUnlocked) {
    elements.adminUnlockInput.focus();
  }
  showSettingsMessage(
    uiState.settingsUnlocked
      ? "Admin tools are unlocked on this device."
      : "Enter the admin key to open connection and admin tools."
  );
}

function closeSettings() {
  uiState.settingsOpen = false;
  elements.settingsModal.hidden = true;
  document.body.classList.remove("settings-open");
}

function handleSettingsUnlock() {
  const adminKey = elements.adminUnlockInput.value.trim();
  if (!adminKey) {
    showSettingsMessage("Enter the admin key first.");
    return;
  }

  state.adminKey = adminKey;
  uiState.settingsUnlocked = true;
  persist();
  render();
  showSettingsMessage("Admin tools unlocked on this device.");
}

function handleSettingsLock() {
  uiState.settingsUnlocked = false;
  render();
  showSettingsMessage("Settings are locked.");
}

function showSettingsMessage(message) {
  elements.settingsMessage.textContent = message;
}

async function handleAddStudentSubmit(event) {
  event.preventDefault();

  let student;
  try {
    student = validateStudentRecord(readAddStudentForm());
  } catch (error) {
    showAddStudentMessage(error.message);
    return;
  }

  uiState.addStudentSaving = true;
  updateAddStudentControls();

  try {
    if (state.apiBase) {
      const savedStudent = normalizeStudentRecord(await apiFetch("/api/students", {
        method: "POST",
        body: JSON.stringify({ student })
      }, { admin: true }));
      state.backendConnected = true;
      elements.studentId.value = savedStudent.student_id;
      persist();
      render();
      closeAddStudentModal(true);
      showMessage(`Added ${savedStudent.first_name} ${savedStudent.last_name}. You can scan them now.`);
      return;
    }

    if (findStudentById(student.student_id)) {
      throw new Error("A student with that ID already exists in this browser.");
    }

    state.localStudents[student.student_id] = student;
    if (typeof state.studentTotals[student.student_id] === "undefined") {
      state.studentTotals[student.student_id] = 0;
    }
    elements.studentId.value = student.student_id;
    persist();
    render();
    closeAddStudentModal(true);
    showMessage(`Added ${student.first_name} ${student.last_name}. You can scan them now.`);
  } catch (error) {
    showAddStudentMessage(formatAddStudentError(error));
  } finally {
    uiState.addStudentSaving = false;
    updateAddStudentControls();
  }
}

async function handleScan(event) {
  event.preventDefault();
  await submitStudentId(elements.studentId.value.trim());
}

async function submitStudentId(studentId) {
  const normalizedStudentId = normalizeStudentIdKey(studentId);
  if (!normalizedStudentId) {
    showMessage("Enter a student ID first.");
    return;
  }

  if (submissionState.inFlight) {
    return;
  }

  if (hasLocalDuplicateScan(normalizedStudentId)) {
    showMessage("This student has already been scanned today in the current section.");
    elements.studentId.value = "";
    return;
  }

  setScanBusy(true);
  try {
    if (state.apiBase) {
      await handleConnectedScan(normalizedStudentId);
    } else {
      handleMockScan(normalizedStudentId);
    }
  } finally {
    setScanBusy(false);
  }
}

async function handleConnectedScan(studentId) {
  const payload = makeQueuedScan(studentId);

  try {
    const result = await apiFetch("/api/scans", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    state.backendConnected = true;
    applyConnectedScanResult(result, payload);
    elements.studentId.value = "";
    persist();
    render();

    if (result.pendingEmailQueued) {
      await refreshPendingEmails();
    }
  } catch (error) {
    elements.studentId.value = "";
    if (error.retriable) {
      rememberLocalScan(studentId);
      enqueueScan(payload);
      persist();
      render();
      showMessage(`${error.message} The scan was queued locally and can be retried.`);
      return;
    }

    persist();
    render();
    showMessage(error.message);
  }
}

function handleMockScan(studentId) {
  const student = findStudentById(studentId);
  if (!student) {
    showMessage("Student not found. Use Add student or connect the backend.");
    return;
  }

  if (hasLocalDuplicateScan(student.student_id)) {
    showMessage("This student has already been scanned today in the current section.");
    return;
  }

  rememberLocalScan(student.student_id);
  state.studentTotals[student.student_id] = (state.studentTotals[student.student_id] || 0) + 1;
  const totalCount = state.studentTotals[student.student_id];
  const threshold = thresholdFor(totalCount);
  state.lastStudent = {
    ...student,
    total_count: totalCount,
    threshold
  };

  upsertRecentScan({
    student_id: student.student_id,
    name: `${student.first_name} ${student.last_name}`,
    team: student.team,
    total_count: totalCount,
    section: state.currentSection,
    synced: false,
    timestamp: new Date().toISOString(),
    clientEventId: makeClientEventId()
  });

  if (state.emailHomeEnabled && /email\s*home/i.test(threshold.title)) {
    upsertPendingEmailLocal(state.lastStudent, `${threshold.title} reached at ${totalCount} ${state.incidentPlural || defaultState.incidentPlural}.`);
  }

  persist();
  render();
  elements.studentId.value = "";
  showMessage(`Recorded scan for ${student.first_name} ${student.last_name}.`);
}

async function handleNewSection() {
  if (!state.apiBase) {
    state.currentSection += 1;
    state.scannedKeys = {};
    state.lastResetTime = new Date().toISOString();
    persist();
    render();
    showMessage(`Section ${state.currentSection} started.`);
    return;
  }

  try {
    const settings = await apiFetch("/api/sections/new", { method: "POST", body: JSON.stringify({}) }, { admin: true });
    applySettings(settings);
    persist();
    render();
    showMessage(`Section ${state.currentSection} started.`);
  } catch (error) {
    showMessage(error.message);
  }
}

async function handleSync() {
  const synced = await trySyncQueue();
  if (synced > 0 && state.apiBase) {
    await refreshPendingEmails();
  }
  render();
  showMessage(synced > 0 ? `Synced ${synced} queued scan${synced === 1 ? "" : "s"}.` : "Nothing new was synced.");
}

async function handleQueueEmail() {
  if (!state.lastStudent) {
    showMessage("Scan a student before queueing an email.");
    return;
  }

  if (state.apiBase) {
    try {
      await apiFetch("/api/pending-emails", {
        method: "POST",
        body: JSON.stringify({
          student: state.lastStudent,
          reason: `Queued manually from the mobile app at ${new Date().toLocaleString()}.`
        })
      });
      await refreshPendingEmails();
      showMessage(`Queued parent email for ${state.lastStudent.first_name} ${state.lastStudent.last_name}.`);
    } catch (error) {
      showMessage(error.message);
    }
    return;
  }

  upsertPendingEmailLocal(state.lastStudent, "Queued manually from mock mode.");
  persist();
  render();
  showMessage(`Queued parent email for ${state.lastStudent.first_name} ${state.lastStudent.last_name}.`);
}

function findPendingEmailItem(studentId) {
  const normalizedId = normalizeStudentIdValue(studentId);
  return state.pendingEmails.find((item, index) => normalizePendingEmailItem(item, index).student_id === normalizedId) || null;
}

async function sendPendingEmailItem(item, draft = null) {
  const emailDraft = draft || buildPendingEmailDraft(item);
  const pending = emailDraft.pending || normalizePendingEmailItem(item);

  if (!emailDraft.to) {
    throw new Error("This student does not have a parent email on file.");
  }

  if (!state.apiBase) {
    const url = new URL(`mailto:${encodeURIComponent(emailDraft.to)}`);
    url.searchParams.set("subject", emailDraft.subject);
    url.searchParams.set("body", emailDraft.body);
    window.location.href = url.toString();
    state.pendingEmails = state.pendingEmails.filter((queued, index) => {
      return normalizePendingEmailItem(queued, index).student_id !== pending.student_id;
    });
    persist();
    render();
    return;
  }

  await apiFetch("/api/send-email", {
    method: "POST",
    body: JSON.stringify({
      student: {
        student_id: pending.student_id,
        first_name: pending.first_name,
        last_name: pending.last_name,
        parent_email: emailDraft.to,
        total_count: pending.total_count,
        threshold: { title: pending.tier }
      },
      to: emailDraft.to,
      subject: emailDraft.subject,
      body: emailDraft.body
    })
  }, { admin: true });

  await refreshPendingEmails();
  persist();
  render();
}

function handlePendingReviewListClick(event) {
  const actionButton = event.target.closest("[data-action][data-student-id]");
  if (!actionButton) {
    return;
  }

  const pendingItem = findPendingEmailItem(actionButton.dataset.studentId);
  if (!pendingItem) {
    showMessage("That pending email is no longer in the queue.");
    return;
  }

  const action = actionButton.dataset.action;
  if (action === "view-pending") {
    openEmailComposer(pendingItem);
    return;
  }

  if (action === "send-pending") {
    sendPendingEmailItem(pendingItem).then(() => {
      showMessage(`Email sent to ${normalizePendingEmailItem(pendingItem).parent_email}.`);
    }).catch((error) => {
      showMessage(error.message);
    });
    return;
  }

  if (action === "delete-pending") {
    deletePendingEmailItem(pendingItem).then(() => {
      showMessage("Pending email deleted.");
    }).catch((error) => {
      showMessage(error.message);
    });
  }
}

async function deletePendingEmailItem(item) {
  const pending = normalizePendingEmailItem(item);
  if (!pending.student_id) {
    throw new Error("That pending email is missing a student ID.");
  }

  if (state.apiBase) {
    await apiFetch("/api/pending-emails/delete", {
      method: "POST",
      body: JSON.stringify({ studentId: pending.student_id })
    }, { admin: true });
    await refreshPendingEmails();
  } else {
    state.pendingEmails = state.pendingEmails.filter((queued, index) => {
      return normalizePendingEmailItem(queued, index).student_id !== pending.student_id;
    });
  }

  persist();
  render();
}

async function handleEmailComposerSubmit(event) {
  event.preventDefault();
  if (!uiState.emailComposerItem) {
    return;
  }

  uiState.emailComposerSending = true;
  renderEmailComposer();
  const draft = {
    ...uiState.emailComposerItem,
    to: String(elements.emailComposerTo.value || "").trim(),
    subject: String(elements.emailComposerSubject.value || "").trim(),
    body: String(elements.emailComposerBody.value || "").trim()
  };

  try {
    await sendPendingEmailItem(uiState.emailComposerItem.pending, draft);
    closeEmailComposer(true);
    renderPendingReviewList();
    showMessage(`Email sent to ${draft.to}.`);
  } catch (error) {
    uiState.emailComposerSending = false;
    renderEmailComposer();
    elements.emailComposerMessage.textContent = error.message || "Unable to send the email.";
    showMessage(error.message);
  }
}

async function handleSendEmail() {
  if (!state.lastStudent) {
    showMessage("Scan a student before sending an email.");
    return;
  }

  if (!state.lastStudent.parent_email) {
    showMessage("This student does not have a parent email on file.");
    return;
  }

  const draft = buildPendingEmailDraft({
    ...state.lastStudent,
    name: `${state.lastStudent.first_name} ${state.lastStudent.last_name}`.trim(),
    total_count: state.lastStudent.total_count || 0,
    tier: state.lastStudent.threshold && state.lastStudent.threshold.title ? state.lastStudent.threshold.title : "Email Home"
  });

  if (!state.apiBase) {
    const url = new URL(`mailto:${encodeURIComponent(draft.to)}`);
    url.searchParams.set("subject", draft.subject);
    url.searchParams.set("body", draft.body);
    window.location.href = url.toString();
    return;
  }

  try {
    await sendPendingEmailItem(draft.pending, draft);
    showMessage(`Email sent to ${draft.to}.`);
  } catch (error) {
    showMessage(error.message);
  }
}

async function handleClearPending() {
  if (!state.apiBase) {
    state.pendingEmails = [];
    persist();
    render();
    return;
  }

  try {
    await apiFetch("/api/pending-emails/clear", { method: "POST", body: JSON.stringify({}) }, { admin: true });
    state.pendingEmails = [];
    persist();
    render();
    showMessage("Pending emails cleared.");
  } catch (error) {
    showMessage(error.message);
  }
}

async function bootstrapFromApi() {
  if (!state.apiBase) {
    showMessage("Enter a backend URL first.");
    return;
  }

  try {
    const payload = await apiFetch("/api/bootstrap");
    state.backendConnected = true;
    applyClientConfig(payload);
    state.thresholds = normalizeThresholds(payload.thresholds || defaultState.thresholds);
    applySettings(payload.settings || {});
    refreshLastStudentThreshold();
    state.pendingEmails = payload.pendingEmails || [];
    persist();
    render();
    showMessage("Backend data refreshed.");
  } catch (error) {
    state.backendConnected = false;
    persist();
    render();
    showMessage(error.message);
  }
}
async function refreshPendingEmails() {
  if (!state.apiBase) {
    return;
  }
  const pendingEmails = await apiFetch("/api/pending-emails");
  state.pendingEmails = pendingEmails;
  persist();
  render();
}

async function trySyncQueue() {
  if (!state.apiBase || state.queue.length === 0) {
    persist();
    return 0;
  }

  let synced = 0;
  const remaining = [];

  for (const payload of state.queue) {
    try {
      const result = await apiFetch("/api/scans", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.backendConnected = true;
      if (!result.duplicate) {
        applyConnectedScanResult(result, payload, true);
      }
      synced += 1;
    } catch (error) {
      if (error.retriable) {
        remaining.push(payload);
      } else {
        synced += 1;
      }
    }
  }

  state.queue = remaining;
  persist();
  return synced;
}

function applyConnectedScanResult(result, payload, fromQueue = false) {
  applySettings({ current_section: result.currentSection || state.currentSection });
  state.lastStudent = result.student;
  const scanSection = (result.scan && result.scan.section) || result.currentSection || state.currentSection;

  if (result.student && result.student.student_id) {
    rememberLocalScan(result.student.student_id, scanSection);
  }

  if (result.duplicate) {
    persist();
    render();
    showMessage("This student has already been scanned today in the current section.");
    return;
  }

  upsertRecentScan({
    student_id: result.student.student_id,
    name: `${result.student.first_name} ${result.student.last_name}`,
    team: result.student.team,
    total_count: result.student.total_count,
    section: scanSection,
    synced: true,
    timestamp: (result.scan && result.scan.timestamp) || new Date().toISOString(),
    clientEventId: payload.clientEventId
  });

  state.queue = state.queue.filter((queued) => queued.clientEventId !== payload.clientEventId);
  if (fromQueue) {
    showMessage(`Synced queued scan for ${result.student.first_name} ${result.student.last_name}.`);
  } else if (result.alreadyProcessed) {
    showMessage(`This scan was already processed for ${result.student.first_name} ${result.student.last_name}.`);
  } else {
    showMessage(`Recorded scan for ${result.student.first_name} ${result.student.last_name}.`);
  }
}

function enqueueScan(payload) {
  if (state.queue.some((item) => item.clientEventId === payload.clientEventId)) {
    return;
  }
  state.queue.unshift(payload);
}

function upsertRecentScan(scan) {
  state.recentScans = [scan, ...state.recentScans.filter((item) => item.clientEventId !== scan.clientEventId)].slice(0, MAX_RECENT_SCANS);
}

function upsertPendingEmailLocal(student, reason) {
  state.pendingEmails = [
    {
      timestamp: new Date().toISOString(),
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      parent_email: student.parent_email || "",
      total_count: student.total_count || 0,
      tier: student.threshold && student.threshold.title ? student.threshold.title : "Manual Review",
      reason
    },
    ...state.pendingEmails.filter((item) => String(item.student_id) !== String(student.student_id))
  ];
}

function applySettings(settings) {
  if (typeof settings.current_section !== "undefined") {
    state.currentSection = Number(settings.current_section) || 1;
  }
  if (typeof settings.email_home_enabled !== "undefined") {
    state.emailHomeEnabled = normalizeBoolean(settings.email_home_enabled);
  }
  if (typeof settings.last_reset_time !== "undefined") {
    state.lastResetTime = settings.last_reset_time || "Never";
  }
}

function applyClientConfig(config = {}) {
  state.schoolName = String(config.schoolName || state.schoolName || defaultState.schoolName);
  state.appTitle = String(config.appTitle || state.appTitle || defaultState.appTitle);
  state.countLabel = String(config.countLabel || state.countLabel || defaultState.countLabel);
  state.incidentSingular = String(config.incidentSingular || state.incidentSingular || defaultState.incidentSingular);
  state.incidentPlural = String(config.incidentPlural || state.incidentPlural || defaultState.incidentPlural);
}

function thresholdFor(totalCount) {
  const thresholds = state.thresholds.length ? state.thresholds : normalizeThresholds(defaultState.thresholds);
  return thresholds.find((threshold) => totalCount >= threshold.min && totalCount <= threshold.max) || thresholds[thresholds.length - 1];
}

function normalizeThresholds(thresholds) {
  return thresholds.map((threshold, index) => normalizeThresholdDraft(threshold, index));
}

async function openScanner() {
  if (scannerState.active || scannerState.opening || scannerState.resolving) {
    return;
  }

  if (!window.Html5Qrcode) {
    showMessage("Camera scanning is not available in this browser.");
    return;
  }

  scannerState.opening = true;
  elements.scannerModal.hidden = false;
  document.body.classList.add("scanner-open");
  elements.scannerMount.innerHTML = "";
  updateScannerStatus("Requesting camera access...");

  try {
    scannerState.instance = new window.Html5Qrcode("scannerMount");
    await startScannerInstance(scannerState.instance);
    scannerState.active = true;
    updateScannerStatus("Point the camera at the barcode on the ID.");
  } catch (error) {
    await closeScanner();
    showMessage(getScannerErrorMessage(error));
  } finally {
    scannerState.opening = false;
  }
}

async function startScannerInstance(instance) {
  const config = {
    fps: 12,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const width = Math.min(Math.floor(viewfinderWidth * 0.96), 560);
      return {
        width,
        height: Math.min(Math.floor(viewfinderHeight * 0.82), Math.max(190, Math.floor(width * 0.68)))
      };
    },
    aspectRatio: 1.333334,
    rememberLastUsedCamera: true,
    formatsToSupport: getScannerFormats()
  };

  const onSuccess = async (decodedText) => {
    if (scannerState.resolving) {
      return;
    }
    scannerState.resolving = true;

    const studentId = normalizeDetectedStudentId(decodedText);
    if (!studentId) {
      updateScannerStatus("Barcode found, but no student ID could be extracted.");
      scannerState.resolving = false;
      return;
    }

    elements.studentId.value = studentId;
    updateScannerStatus(`Scanned ${studentId}.`);
    await closeScanner();
    await submitStudentId(studentId);
    scannerState.resolving = false;
  };

  let failedFrames = 0;
  const onFailure = () => {
    failedFrames += 1;
    if (failedFrames === 40) {
      updateScannerStatus("Hold the barcode flat, fill most of the box, and move a little closer.");
    }
  };

  try {
    await instance.start({ facingMode: "environment" }, config, onSuccess, onFailure);
  } catch (error) {
    const cameras = await window.Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      throw error;
    }
    const preferredCamera = cameras.find((camera) => /back|rear|environment/i.test(camera.label)) || cameras[0];
    await instance.start(preferredCamera.id, config, onSuccess, onFailure);
  }
}

function getScannerFormats() {
  const formats = window.Html5QrcodeSupportedFormats;
  if (!formats) {
    return undefined;
  }
  return [
    formats.CODE_128,
    formats.CODE_39,
    formats.CODE_93,
    formats.CODABAR,
    formats.EAN_13,
    formats.EAN_8,
    formats.ITF,
    formats.PDF_417,
    formats.UPC_A,
    formats.UPC_E,
    formats.QR_CODE
  ].filter(Boolean);
}

function normalizeDetectedStudentId(decodedText) {
  const raw = String(decodedText || "").trim();
  if (!raw) {
    return "";
  }

  const digitMatches = raw.match(/\d{4,}/g);
  if (digitMatches && digitMatches.length > 0) {
    return digitMatches.sort((left, right) => right.length - left.length)[0];
  }

  const tokenMatches = raw.match(/[A-Z0-9]{4,}/gi);
  if (tokenMatches && tokenMatches.length > 0) {
    return tokenMatches.sort((left, right) => right.length - left.length)[0];
  }

  return raw;
}

function updateScannerStatus(message) {
  elements.scannerStatus.textContent = message;
}

function getScannerErrorMessage(error) {
  const message = String(error && error.message ? error.message : error || "");
  if (/Permission|NotAllowed/i.test(message)) {
    return "Camera permission was blocked. Allow camera access and try again.";
  }
  if (/NotFound|Overconstrained|No camera/i.test(message)) {
    return "No rear camera was available on this device.";
  }
  return "The camera scanner could not start on this phone. You can still type the student ID manually.";
}

async function closeScanner() {
  document.body.classList.remove("scanner-open");
  elements.scannerModal.hidden = true;
  updateScannerStatus("Allow camera access, then point the phone at the barcode.");

  const instance = scannerState.instance;
  scannerState.active = false;
  scannerState.opening = false;
  scannerState.instance = null;

  if (!instance) {
    return;
  }

  try {
    await instance.stop();
  } catch {}

  try {
    await instance.clear();
  } catch {}

  elements.scannerMount.innerHTML = "";
}

async function apiFetch(path, options = {}, { admin = false } = {}) {
  if (!state.apiBase) {
    throw new Error("Backend URL is not configured.");
  }

  if (isAppsScriptBackend()) {
    return apiFetchAppsScript(path, options, { admin });
  }

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (admin) {
    if (!state.adminKey) {
      throw new Error("Open Admin settings and enter the admin key first.");
    }
    headers.set("x-admin-key", state.adminKey);
  }

  let response;
  try {
    response = await fetch(`${state.apiBase}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    const networkError = new Error("Unable to reach the backend.");
    networkError.retriable = true;
    throw networkError;
  }

  const text = await response.text();
  const data = safeJsonParse(text, {});
  if (!response.ok) {
    const requestError = new Error(data.error || `Request failed (${response.status})`);
    requestError.status = response.status;
    throw requestError;
  }
  return data;
}

function isAppsScriptBackend() {
  return /script\.google(?:usercontent)?\.com|\/macros\/s\//i.test(state.apiBase);
}

async function apiFetchAppsScript(path, options = {}, { admin = false } = {}) {
  const endpoint = String(path).replace(/^\/api\//, "");
  const method = String(options.method || "GET").toUpperCase();
  const payload = options.body ? safeJsonParse(options.body, {}) : {};

  if (admin) {
    if (!state.adminKey) {
      throw new Error("Open Admin settings and enter the admin key first.");
    }
    payload.adminKey = state.adminKey;
  }

  let response;
  try {
    if (method === "GET") {
      const url = new URL(state.apiBase);
      url.searchParams.set("endpoint", endpoint);
      for (const [key, value] of Object.entries(payload)) {
        if (value === null || typeof value === "undefined" || typeof value === "object") {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
      response = await fetch(url.toString(), { method: "GET" });
    } else {
      const form = new URLSearchParams();
      form.set("payload", JSON.stringify({ endpoint, ...payload }));
      response = await fetch(state.apiBase, {
        method: "POST",
        body: form
      });
    }
  } catch (error) {
    return apiFetchAppsScriptJsonp(endpoint, method, payload);
  }

  const text = await response.text();
  const data = safeJsonParse(text, {});
  if (!response.ok || data.error) {
    const requestError = new Error(data.error || `Request failed (${response.status})`);
    requestError.status = response.status;
    requestError.retriable = !response.ok && response.status >= 500;
    throw requestError;
  }
  return data;
}

function apiFetchAppsScriptJsonp(endpoint, method, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `__lanyardJsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(state.apiBase);
    const jsonpPayload = { endpoint, _method: method, ...payload };
    let settled = false;

    function cleanup() {
      settled = true;
      delete window[callbackName];
      script.remove();
    }

    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      cleanup();
      const networkError = new Error("Unable to reach the Apps Script backend.");
      networkError.retriable = true;
      reject(networkError);
    }, APPS_SCRIPT_JSONP_TIMEOUT_MS);

    window[callbackName] = (data) => {
      if (settled) {
        return;
      }
      window.clearTimeout(timeout);
      cleanup();
      if (data && data.error) {
        reject(new Error(data.error));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      if (settled) {
        return;
      }
      window.clearTimeout(timeout);
      cleanup();
      const networkError = new Error("Unable to reach the Apps Script backend.");
      networkError.retriable = true;
      reject(networkError);
    };

    url.searchParams.set("callback", callbackName);
    url.searchParams.set("payload", JSON.stringify(jsonpPayload));
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

function safeJsonParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function makeQueuedScan(studentId) {
  return {
    studentId,
    clientEventId: makeClientEventId(),
    deviceName: detectDeviceName(),
    createdAt: new Date().toISOString()
  };
}

function detectDeviceName() {
  return [navigator.platform || "web", navigator.language || "en-US"].join(" | ");
}

function makeClientEventId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function resolveRuntimeConfig() {
  if (typeof window === "undefined") {
    return {
      profileId: "default",
      defaultSchoolName: "Avon North",
      appTitle: "Lanyard Tracker",
      countLabel: "Total violations",
      incidentSingular: "violation",
      incidentPlural: "violations",
      defaultApiBase: "",
      forceDefaultApiBase: false,
      showTeam: true,
      defaultThresholds: clone(DEFAULT_APP_THRESHOLDS)
    };
  }

  const url = new URL(window.location.href);
  const profileId = String(url.searchParams.get("profile") || "").trim();
  const profileConfig = PROFILE_CONFIGS[profileId] || {};
  const inlineConfig = window.LANYARD_APP_CONFIG || {};

  return {
    profileId: String(inlineConfig.profileId || profileId || profileConfig.profileId || "default"),
    defaultSchoolName: String(inlineConfig.defaultSchoolName || profileConfig.defaultSchoolName || "Avon North"),
    appTitle: String(inlineConfig.appTitle || profileConfig.appTitle || "Lanyard Tracker"),
    countLabel: String(inlineConfig.countLabel || profileConfig.countLabel || "Total violations"),
    incidentSingular: String(inlineConfig.incidentSingular || profileConfig.incidentSingular || "violation"),
    incidentPlural: String(inlineConfig.incidentPlural || profileConfig.incidentPlural || "violations"),
    defaultApiBase: sanitizeBaseUrl(inlineConfig.defaultApiBase || profileConfig.defaultApiBase || ""),
    forceDefaultApiBase: typeof inlineConfig.forceDefaultApiBase === "boolean"
      ? inlineConfig.forceDefaultApiBase
      : Boolean(profileConfig.forceDefaultApiBase),
    showTeam: typeof inlineConfig.showTeam === "boolean"
      ? inlineConfig.showTeam
      : (typeof profileConfig.showTeam === "boolean" ? profileConfig.showTeam : true),
    defaultEmailHomeEnabled: typeof inlineConfig.defaultEmailHomeEnabled === "boolean"
      ? inlineConfig.defaultEmailHomeEnabled
      : (typeof profileConfig.defaultEmailHomeEnabled === "boolean" ? profileConfig.defaultEmailHomeEnabled : true),
    defaultThresholds: clone(inlineConfig.defaultThresholds || profileConfig.defaultThresholds || DEFAULT_APP_THRESHOLDS)
  };
}

function normalizeBoolean(value) {
  return [true, "true", "1", 1, "yes", "on"].includes(value);
}

function rgbArrayToHex(color) {
  const [r, g, b] = color.map((part) => Math.max(0, Math.min(255, Math.round(Number(part) * 255))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function normalizeHexColor(hex) {
  const clean = String(hex || "").trim().replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }
  return "#ffffff";
}

function textColorForHex(hex) {
  const clean = normalizeHexColor(hex).replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#17324d" : "#fffaf1";
}

function hexToRgbArray(hex) {
  const clean = normalizeHexColor(hex).replace("#", "");
  if (clean.length !== 6) {
    return [1, 1, 1];
  }
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
}

function todayKey() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatResetTime(value) {
  if (!value || value === "Never") {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function showMessage(message) {
  elements.scanMessage.textContent = message;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register(`./service-worker.js?v=${ASSET_VERSION}`)
      .then((registration) => registration.update())
      .catch(() => {});
  }
}







