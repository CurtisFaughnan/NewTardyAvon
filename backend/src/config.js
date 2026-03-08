const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function readBoolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadServiceAccount() {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  if (filePath) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path.resolve(filePath));
  }

  return null;
}

const config = {
  port: readNumber("PORT", 8787),
  clientOrigins: splitCsv(process.env.CLIENT_ORIGIN),
  adminKey: process.env.ADMIN_KEY || "",
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || "",
  spreadsheetName: process.env.GOOGLE_SPREADSHEET_NAME || "Lanyard_Data",
  serviceAccount: loadServiceAccount(),
  studentSheet: process.env.STUDENT_SHEET || "Lanyard_Data",
  scanLogSheet: process.env.SCAN_LOG_SHEET || "lanyard_log",
  thresholdsSheet: process.env.THRESHOLDS_SHEET || "Thresholds",
  pendingEmailsSheet: process.env.PENDING_EMAILS_SHEET || "Pending_Emails",
  sentEmailsSheet: process.env.SENT_EMAILS_SHEET || "Sent_Emails",
  settingsSheet: process.env.SETTINGS_SHEET || "App_Settings",
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: readNumber("SMTP_PORT", 465),
    secure: readBoolean("SMTP_SECURE", true),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || ""
  },
  schoolName: process.env.SCHOOL_NAME || "Avon North Middle School"
};

module.exports = { config };
