const STORAGE_KEY = "lanyard-mobile-shell-v2";
const MAX_RECENT_SCANS = 12;

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
  apiBase: "",
  adminKey: "",
  backendConnected: false,
  currentSection: 1,
  emailHomeEnabled: true,
  lastResetTime: "Never",
  studentTotals: { "1001": 3, "1002": 8, "1003": 1 },
  scannedKeys: {},
  recentScans: [],
  pendingEmails: [],
  queue: [],
  lastStudent: null,
  thresholds: [
    { min: 1, max: 4, title: "Tier 1", color: [0.31, 0.49, 0.39], hex: "#4f7d63" },
    { min: 5, max: 9, title: "Tier 2", color: [0.83, 0.61, 0.17], hex: "#d39b2b" },
    { min: 10, max: 14, title: "Email Home", color: [0.73, 0.38, 0.33], hex: "#b96253" },
    { min: 15, max: 9999, title: "Tier 4", color: [0.09, 0.2, 0.3], hex: "#17324d" }
  ]
};

const state = loadState();
const elements = {
  form: document.getElementById("scanForm"),
  studentId: document.getElementById("studentId"),
  scanMessage: document.getElementById("scanMessage"),
  queueCount: document.getElementById("queueCount"),
  sectionCount: document.getElementById("sectionCount"),
  resetBadge: document.getElementById("resetBadge"),
  modeBadge: document.getElementById("modeBadge"),
  recentScans: document.getElementById("recentScans"),
  pendingEmails: document.getElementById("pendingEmails"),
  thresholdList: document.getElementById("thresholdList"),
  studentEmpty: document.getElementById("studentEmpty"),
  studentDetail: document.getElementById("studentDetail"),
  studentName: document.getElementById("studentName"),
  studentCode: document.getElementById("studentCode"),
  studentTeam: document.getElementById("studentTeam"),
  studentYear: document.getElementById("studentYear"),
  studentCount: document.getElementById("studentCount"),
  studentThreshold: document.getElementById("studentThreshold"),
  studentEmail: document.getElementById("studentEmail"),
  emailHomeToggle: document.getElementById("emailHomeToggle"),
  apiBaseInput: document.getElementById("apiBaseInput"),
  adminKeyInput: document.getElementById("adminKeyInput"),
  newSectionBtn: document.getElementById("newSectionBtn"),
  syncBtn: document.getElementById("syncBtn"),
  refreshBackendBtn: document.getElementById("refreshBackendBtn"),
  queueEmailBtn: document.getElementById("queueEmailBtn"),
  sendEmailBtn: document.getElementById("sendEmailBtn"),
  clearPendingBtn: document.getElementById("clearPendingBtn")
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
  elements.newSectionBtn.addEventListener("click", handleNewSection);
  elements.syncBtn.addEventListener("click", handleSync);
  elements.refreshBackendBtn.addEventListener("click", bootstrapFromApi);
  elements.queueEmailBtn.addEventListener("click", handleQueueEmail);
  elements.sendEmailBtn.addEventListener("click", handleSendEmail);
  elements.clearPendingBtn.addEventListener("click", handleClearPending);

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
    persist();
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(defaultState);
    }
    return {
      ...clone(defaultState),
      ...JSON.parse(raw)
    };
  } catch {
    return clone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  elements.queueCount.textContent = String(state.queue.length);
  elements.sectionCount.textContent = String(state.currentSection || 1);
  elements.resetBadge.textContent = formatResetTime(state.lastResetTime);
  elements.modeBadge.textContent = state.apiBase ? (state.backendConnected ? "Connected" : "Configured") : "Mock mode";
  elements.emailHomeToggle.checked = Boolean(state.emailHomeEnabled);
  elements.apiBaseInput.value = state.apiBase;
  elements.adminKeyInput.value = state.adminKey;
  renderStudent();
  renderRecentScans();
  renderPendingEmails();
  renderThresholds();
}

function renderStudent() {
  if (!state.lastStudent) {
    elements.studentEmpty.hidden = false;
    elements.studentDetail.hidden = true;
    return;
  }

  elements.studentEmpty.hidden = true;
  elements.studentDetail.hidden = false;
  elements.studentName.textContent = `${state.lastStudent.first_name} ${state.lastStudent.last_name}`;
  elements.studentCode.textContent = state.lastStudent.student_id || "";
  elements.studentTeam.textContent = state.lastStudent.team || "Unknown";
  elements.studentYear.textContent = state.lastStudent.class_year || "Unknown";
  elements.studentCount.textContent = String(state.lastStudent.total_count || 0);
  elements.studentThreshold.textContent = (state.lastStudent.threshold && state.lastStudent.threshold.title) || "Unknown";
  elements.studentEmail.textContent = state.lastStudent.parent_email || "Not available";
}

function renderRecentScans() {
  const items = state.recentScans.map((scan) => `
    <li>
      <strong>${escapeHtml(scan.name)}</strong>
      <small>${escapeHtml(scan.student_id)} | ${escapeHtml(scan.team || "No team")}</small>
      <small>Count ${escapeHtml(String(scan.total_count || 0))} | Section ${escapeHtml(String(scan.section || 1))} | ${escapeHtml(scan.synced ? "Synced" : "Queued")}</small>
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

function renderThresholds() {
  elements.thresholdList.innerHTML = state.thresholds.map((threshold) => {
    const hex = threshold.hex || rgbArrayToHex(threshold.color || [1, 1, 1]);
    return `
      <div class="threshold-item">
        <div>
          <strong>${escapeHtml(threshold.title)}</strong>
          <div class="helper">${escapeHtml(String(threshold.min))} to ${escapeHtml(String(threshold.max))} violations</div>
        </div>
        <span class="threshold-pill" style="background:${hex}">${escapeHtml(threshold.title)}</span>
      </div>
    `;
  }).join("");
}

async function handleScan(event) {
  event.preventDefault();
  const studentId = elements.studentId.value.trim();
  if (!studentId) {
    showMessage("Enter a student ID first.");
    return;
  }

  if (state.apiBase) {
    await handleConnectedScan(studentId);
  } else {
    handleMockScan(studentId);
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
  const student = sampleStudents[studentId];
  if (!student) {
    showMessage("Student not found in mock mode. Try 1001, 1002, or 1003.");
    return;
  }

  const scanKey = `${todayKey()}:${state.currentSection}:${student.student_id}`;
  if (state.scannedKeys[scanKey]) {
    showMessage("This student has already been scanned in the current section.");
    return;
  }

  state.scannedKeys[scanKey] = true;
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

  if (state.emailHomeEnabled && threshold.title.toLowerCase() === "email home") {
    upsertPendingEmailLocal(state.lastStudent, `${threshold.title} reached at ${totalCount} violations.`);
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

async function handleSendEmail() {
  if (!state.lastStudent) {
    showMessage("Scan a student before sending an email.");
    return;
  }

  if (!state.lastStudent.parent_email) {
    showMessage("This student does not have a parent email on file.");
    return;
  }

  if (!state.apiBase) {
    window.location.href = `mailto:${encodeURIComponent(state.lastStudent.parent_email)}`;
    return;
  }

  try {
    await apiFetch("/api/send-email", {
      method: "POST",
      body: JSON.stringify({ student: state.lastStudent })
    }, { admin: true });
    await refreshPendingEmails();
    showMessage(`Email sent to ${state.lastStudent.parent_email}.`);
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
    state.thresholds = normalizeThresholds(payload.thresholds || defaultState.thresholds);
    applySettings(payload.settings || {});
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

  if (result.duplicate) {
    persist();
    render();
    showMessage("This student has already been scanned in the current section.");
    return;
  }

  upsertRecentScan({
    student_id: result.student.student_id,
    name: `${result.student.first_name} ${result.student.last_name}`,
    team: result.student.team,
    total_count: result.student.total_count,
    section: (result.scan && result.scan.section) || state.currentSection,
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

function thresholdFor(totalCount) {
  return state.thresholds.find((threshold) => totalCount >= threshold.min && totalCount <= threshold.max) || state.thresholds[state.thresholds.length - 1];
}

function normalizeThresholds(thresholds) {
  return thresholds.map((threshold) => ({
    ...threshold,
    min: Number(threshold.min),
    max: Number(threshold.max),
    color: threshold.color || hexToRgbArray(threshold.hex || "#ffffff"),
    hex: threshold.hex || rgbArrayToHex(threshold.color || [1, 1, 1])
  }));
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
      throw new Error("Enter the admin key in the settings card first.");
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
      throw new Error("Enter the admin key in the settings card first.");
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
    const networkError = new Error("Unable to reach the Apps Script backend.");
    networkError.retriable = true;
    throw networkError;
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

function normalizeBoolean(value) {
  return [true, "true", "1", 1, "yes", "on"].includes(value);
}

function rgbArrayToHex(color) {
  const [r, g, b] = color.map((part) => Math.max(0, Math.min(255, Math.round(Number(part) * 255))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgbArray(hex) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) {
    return [1, 1, 1];
  }
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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

function showMessage(message) {
  elements.scanMessage.textContent = message;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}






