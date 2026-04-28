const { google } = require("googleapis");
const { config } = require("./config");

const DEFAULT_THRESHOLDS = [
  { min: 1, max: 4, color: [0, 1, 0], title: "Tier 1" },
  { min: 5, max: 9, color: [1, 1, 0.6], title: "Tier 2" },
  { min: 10, max: 14, color: [1, 0.8, 0.5], title: "Email Home" },
  { min: 15, max: 9999, color: [1, 0.6, 0.6], title: "Tier 4" }
];

const SHEET_HEADERS = {
  student: ["student_id", "first_name", "last_name", "class_year", "team", "parent_email"],
  scanLog: ["timestamp", "student_id", "name", "class_year", "team", "scan_number", "parent_email", "device_name", "section", "scan_date", "client_event_id"],
  thresholds: ["min", "max", "r", "g", "b", "title"],
  pendingEmails: ["timestamp", "student_id", "name", "parent_email", "total_count", "tier", "reason", "status"],
  sentEmails: ["timestamp", "student_id", "name", "parent_email", "total_count", "tier", "subject", "status"],
  settings: ["key", "value"]
};

let spreadsheetIdPromise;

const HEADER_ALIASES = {
  student_id: ["studentid", "studentnumber", "studentno", "id"],
  first_name: ["firstname", "fname", "first"],
  last_name: ["lastname", "lname", "last"],
  class_year: ["classyear", "gradeyear", "grade", "year"],
  team: ["teamname", "team"],
  parent_email: ["parentemail", "guardianemail", "parentguardianemail", "email", "emailaddress"],
  scan_number: ["scannumber", "scancount", "totalcount", "count"],
  device_name: ["devicename", "device"],
  scan_date: ["scandate", "date"],
  client_event_id: ["clienteventid", "eventid"]
};

function normalizeHeaderName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function canonicalHeaderName(header) {
  const normalized = normalizeHeaderName(header);
  if (!normalized) {
    return "";
  }

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (normalizeHeaderName(canonical) === normalized || aliases.includes(normalized)) {
      return canonical;
    }
  }

  if (normalized.includes("email")) {
    return "parent_email";
  }

  return String(header ?? "").trim();
}

function makeHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeStudentId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  if (/^\d+(\.0+)?$/.test(raw)) {
    return String(Number.parseInt(raw, 10));
  }

  return raw.replace(/^0+/, "") || "0";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseMaybeJson(value) {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb.map((part) => Math.max(0, Math.min(255, Math.round(Number(part) * 255))));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

async function getAuthClient() {
  if (!config.serviceAccount) {
    throw new Error("Missing Google service account configuration.");
  }

  return new google.auth.JWT({
    email: config.serviceAccount.client_email,
    key: config.serviceAccount.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });
}

async function getApis() {
  const auth = await getAuthClient();
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth })
  };
}

async function resolveSpreadsheetId() {
  if (spreadsheetIdPromise) {
    return spreadsheetIdPromise;
  }

  spreadsheetIdPromise = (async () => {
    if (config.spreadsheetId) {
      return config.spreadsheetId;
    }

    const { drive } = await getApis();
    const response = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name='${config.spreadsheetName.replace(/'/g, "\\'")}'`,
      fields: "files(id,name)",
      pageSize: 2
    });

    const file = response.data.files && response.data.files[0];
    if (!file) {
      throw new Error(`Spreadsheet named \"${config.spreadsheetName}\" was not found.`);
    }

    return file.id;
  })();

  return spreadsheetIdPromise;
}

async function getSpreadsheetMetadata() {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return response.data;
}

async function ensureSheet(title, headerRow) {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  const metadata = await getSpreadsheetMetadata();
  const exists = (metadata.sheets || []).some((sheet) => sheet.properties && sheet.properties.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }]
      }
    });
  }

  const currentValues = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A1:Z2`
  });

  const rows = currentValues.data.values || [];
  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headerRow] }
    });
  }
}

async function getRows(sheetName, headerRow) {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  await ensureSheet(sheetName, headerRow);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`
  });
  const rows = response.data.values || [];
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      const value = row[index] ?? "";
      const rawHeader = String(header ?? "").trim();
      const canonicalHeader = canonicalHeaderName(rawHeader);
      if (rawHeader) {
        record[rawHeader] = value;
      }
      if (canonicalHeader) {
        const hasExistingValue = String(record[canonicalHeader] ?? "").trim() !== "";
        const hasNextValue = String(value ?? "").trim() !== "";
        if (!hasExistingValue || hasNextValue) {
          record[canonicalHeader] = value;
        }
      }
    });
    return record;
  });
}

async function overwriteSheet(sheetName, headerRow, rows) {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  await ensureSheet(sheetName, headerRow);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headerRow, ...rows] }
  });
}

async function appendRow(sheetName, headerRow, row) {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  await ensureSheet(sheetName, headerRow);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] }
  });
}

async function getSheetHeaders(sheetName, fallbackHeaders) {
  const { sheets } = await getApis();
  const spreadsheetId = await resolveSpreadsheetId();
  await ensureSheet(sheetName, fallbackHeaders);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`
  });
  const headers = ((response.data.values || [])[0] || []).map((header) => String(header || "").trim());
  return headers.some(Boolean) ? headers : fallbackHeaders.slice();
}

async function getStudents() {
  const rows = await getRows(config.studentSheet, SHEET_HEADERS.student);
  return rows.map((student) => ({
    ...student,
    student_id: String(student.student_id || ""),
    first_name: String(student.first_name || ""),
    last_name: String(student.last_name || ""),
    class_year: String(student.class_year || ""),
    team: String(student.team || ""),
    parent_email: String(student.parent_email || "")
  }));
}

async function getStudentById(studentId) {
  const target = normalizeStudentId(studentId);
  const students = await getStudents();
  return students.find((student) => normalizeStudentId(student.student_id) === target) || null;
}

function sanitizeStudentInput(student = {}) {
  const normalized = {
    student_id: normalizeStudentId(student.student_id || student.studentId || student.id || ""),
    first_name: String(student.first_name || student.firstName || "").trim(),
    last_name: String(student.last_name || student.lastName || "").trim(),
    class_year: String(student.class_year || student.classYear || student.grade || "").trim(),
    team: String(student.team || "").trim(),
    parent_email: String(student.parent_email || student.parentEmail || student.email || "").trim()
  };

  if (!normalized.student_id) {
    throw makeHttpError("Student ID is required.");
  }
  if (!normalized.first_name) {
    throw makeHttpError("First name is required.");
  }
  if (!normalized.last_name) {
    throw makeHttpError("Last name is required.");
  }
  if (!normalized.class_year) {
    throw makeHttpError("Class year is required.");
  }
  if (normalized.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.parent_email)) {
    throw makeHttpError("Parent email must be valid or blank.");
  }

  return normalized;
}

function studentValueForHeader(student, header) {
  switch (canonicalHeaderName(header)) {
    case "student_id":
      return student.student_id;
    case "first_name":
      return student.first_name;
    case "last_name":
      return student.last_name;
    case "class_year":
      return student.class_year;
    case "team":
      return student.team;
    case "parent_email":
      return student.parent_email;
    default:
      return "";
  }
}

async function addStudent(student) {
  const sanitized = sanitizeStudentInput(student);
  const existing = await getStudentById(sanitized.student_id);
  if (existing) {
    throw makeHttpError("A student with that ID already exists.", 409);
  }

  const headers = await getSheetHeaders(config.studentSheet, SHEET_HEADERS.student);
  const canonicalHeaders = headers.map(canonicalHeaderName);
  const missingHeaders = ["student_id", "first_name", "last_name", "class_year"].filter((header) => !canonicalHeaders.includes(header));
  if (missingHeaders.length > 0) {
    throw makeHttpError(`Students sheet is missing required columns: ${missingHeaders.join(", ")}`);
  }

  await appendRow(
    config.studentSheet,
    SHEET_HEADERS.student,
    headers.map((header) => studentValueForHeader(sanitized, header))
  );

  return sanitized;
}

async function getThresholds() {
  const rows = await getRows(config.thresholdsSheet, SHEET_HEADERS.thresholds);
  if (rows.length === 0) {
    await overwriteSheet(
      config.thresholdsSheet,
      SHEET_HEADERS.thresholds,
      DEFAULT_THRESHOLDS.map((threshold) => [threshold.min, threshold.max, threshold.color[0], threshold.color[1], threshold.color[2], threshold.title])
    );
    return DEFAULT_THRESHOLDS.map((threshold) => ({ ...threshold, hex: rgbToHex(threshold.color) }));
  }

  return rows.map((row) => {
    const color = [Number(row.r || 0), Number(row.g || 0), Number(row.b || 0)];
    return {
      min: Number(row.min || 0),
      max: Number(row.max || 0),
      color,
      title: row.title || "Tier",
      hex: rgbToHex(color)
    };
  });
}

function thresholdForCount(thresholds, totalCount) {
  return thresholds.find((threshold) => totalCount >= threshold.min && totalCount <= threshold.max) || thresholds[thresholds.length - 1];
}

async function getSettings() {
  const rows = await getRows(config.settingsSheet, SHEET_HEADERS.settings);
  if (rows.length === 0) {
    const defaults = {
      current_section: 1,
      email_home_enabled: true,
      last_reset_time: "Never"
    };
    await overwriteSheet(
      config.settingsSheet,
      SHEET_HEADERS.settings,
      Object.entries(defaults).map(([key, value]) => [key, JSON.stringify(value)])
    );
    return defaults;
  }

  return rows.reduce((accumulator, row) => {
    accumulator[row.key] = parseMaybeJson(row.value);
    return accumulator;
  }, {});
}

async function saveSettings(patch) {
  const nextSettings = {
    ...(await getSettings()),
    ...patch
  };

  await overwriteSheet(
    config.settingsSheet,
    SHEET_HEADERS.settings,
    Object.entries(nextSettings).map(([key, value]) => [key, JSON.stringify(value)])
  );

  return nextSettings;
}

async function getScanRows() {
  return getRows(config.scanLogSheet, SHEET_HEADERS.scanLog);
}

function inferScanDate(row) {
  if (row.scan_date) {
    return String(row.scan_date).slice(0, 10);
  }
  if (row.timestamp) {
    return String(row.timestamp).slice(0, 10);
  }
  return "";
}

function decorateStudent(student, totalCount, threshold) {
  return {
    ...student,
    student_id: String(student.student_id),
    total_count: totalCount,
    threshold
  };
}

async function recordScan({ studentId, deviceName, clientEventId }) {
  const student = await getStudentById(studentId);
  if (!student) {
    return { notFound: true };
  }

  const [settings, thresholds, scanRows] = await Promise.all([
    getSettings(),
    getThresholds(),
    getScanRows()
  ]);

  const today = todayKey();
  const currentSection = Number(settings.current_section || 1);
  const normalizedStudentId = normalizeStudentId(student.student_id);

  if (clientEventId) {
    const existingEvent = scanRows.find((row) => row.client_event_id && row.client_event_id === clientEventId);
    if (existingEvent) {
      const totalCount = Number(existingEvent.scan_number || 0);
      const threshold = thresholdForCount(thresholds, totalCount);
      return {
        duplicate: false,
        alreadyProcessed: true,
        currentSection,
        student: decorateStudent(student, totalCount, threshold),
        scan: {
          timestamp: existingEvent.timestamp,
          section: Number(existingEvent.section || currentSection),
          synced: true,
          client_event_id: clientEventId
        }
      };
    }
  }

  const duplicate = scanRows.some((row) => normalizeStudentId(row.student_id) === normalizedStudentId && String(row.section || currentSection) === String(currentSection) && inferScanDate(row) === today);
  const previousCount = scanRows.filter((row) => normalizeStudentId(row.student_id) === normalizedStudentId).length;
  const totalCount = previousCount + (duplicate ? 0 : 1);
  const threshold = thresholdForCount(thresholds, totalCount || previousCount || 1);

  if (duplicate) {
    return {
      duplicate: true,
      currentSection,
      student: decorateStudent(student, previousCount, threshold)
    };
  }

  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    student.student_id,
    `${student.first_name} ${student.last_name}`,
    student.class_year || "",
    student.team || "",
    totalCount,
    student.parent_email || "",
    deviceName || "web",
    currentSection,
    today,
    clientEventId || ""
  ];

  await appendRow(config.scanLogSheet, SHEET_HEADERS.scanLog, row);

  let pendingEmailQueued = false;
  if (String(settings.email_home_enabled).toLowerCase() !== "false" && threshold.title.trim().toLowerCase() === "email home") {
    pendingEmailQueued = true;
    await upsertPendingEmail({
      timestamp,
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      parent_email: student.parent_email || "",
      total_count: totalCount,
      tier: threshold.title,
      reason: `${threshold.title} reached at ${totalCount} violations.`,
      status: "pending"
    });
  }

  return {
    duplicate: false,
    pendingEmailQueued,
    currentSection,
    student: decorateStudent(student, totalCount, threshold),
    scan: {
      timestamp,
      section: currentSection,
      synced: true,
      client_event_id: clientEventId || ""
    }
  };
}

async function getPendingEmails() {
  const rows = await getRows(config.pendingEmailsSheet, SHEET_HEADERS.pendingEmails);
  return rows.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
}

async function upsertPendingEmail(record) {
  const rows = await getPendingEmails();
  const filtered = rows.filter((row) => normalizeStudentId(row.student_id) !== normalizeStudentId(record.student_id));
  filtered.unshift(record);
  await overwriteSheet(
    config.pendingEmailsSheet,
    SHEET_HEADERS.pendingEmails,
    filtered.map((row) => [row.timestamp, row.student_id, row.name, row.parent_email, row.total_count, row.tier, row.reason, row.status])
  );
}

async function clearPendingEmails() {
  await overwriteSheet(config.pendingEmailsSheet, SHEET_HEADERS.pendingEmails, []);
}

async function removePendingEmail(studentId) {
  const rows = await getPendingEmails();
  const filtered = rows.filter((row) => normalizeStudentId(row.student_id) !== normalizeStudentId(studentId));
  await overwriteSheet(
    config.pendingEmailsSheet,
    SHEET_HEADERS.pendingEmails,
    filtered.map((row) => [row.timestamp, row.student_id, row.name, row.parent_email, row.total_count, row.tier, row.reason, row.status])
  );
}

async function getSentEmails() {
  const rows = await getRows(config.sentEmailsSheet, SHEET_HEADERS.sentEmails);
  return rows.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
}

async function appendSentEmail(record) {
  await appendRow(config.sentEmailsSheet, SHEET_HEADERS.sentEmails, [record.timestamp, record.student_id, record.name, record.parent_email, record.total_count, record.tier, record.subject, record.status]);
}

module.exports = {
  DEFAULT_THRESHOLDS,
  addStudent,
  config,
  clearPendingEmails,
  getPendingEmails,
  getSentEmails,
  getSettings,
  getStudentById,
  getThresholds,
  normalizeStudentId,
  recordScan,
  removePendingEmail,
  saveSettings,
  thresholdForCount,
  appendSentEmail,
  upsertPendingEmail
};
