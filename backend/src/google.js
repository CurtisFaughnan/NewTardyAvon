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

function normalizeStudentId(value) {
  return String(value ?? "").trim().replace(/^0+/, "") || "0";
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
      record[header] = row[index] ?? "";
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

async function getStudents() {
  return getRows(config.studentSheet, SHEET_HEADERS.student);
}

async function getStudentById(studentId) {
  const target = normalizeStudentId(studentId);
  const students = await getStudents();
  return students.find((student) => normalizeStudentId(student.student_id) === target) || null;
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
