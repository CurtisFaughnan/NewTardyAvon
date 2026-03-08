const DEFAULT_SHEET_ID = '1RnnPmQITQtevn04cMKw_PMflLr7jbAeDJ3PfXZaBDwE';
const DEFAULT_SCHOOL_NAME = 'Avon North Middle School';
const DEFAULT_ADMIN_KEY = 'AvonNorth';
const SHEETS = {
  students: 'Lanyard_Data',
  scans: 'lanyard_log',
  thresholds: 'Thresholds',
  pendingEmails: 'Pending_Emails',
  sentEmails: 'Sent_Emails',
  settings: 'App_Settings'
};
const DEFAULT_THRESHOLDS = [
  { min: 1, max: 4, color: [0.0, 1.0, 0.0], title: 'Tier 1' },
  { min: 5, max: 9, color: [1.0, 1.0, 0.6], title: 'Tier 2' },
  { min: 10, max: 14, color: [1.0, 0.8, 0.5], title: 'Email Home' },
  { min: 15, max: 9999, color: [1.0, 0.6, 0.6], title: 'Tier 4' }
];
const DEFAULT_SETTINGS = {
  current_section: 1,
  email_home_enabled: true,
  last_reset_time: 'Never'
};

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const request = parseRequest_(e, method);
    const data = routeRequest_(request);
    return jsonResponse_(data);
  } catch (error) {
    return jsonResponse_({ error: error.message || 'Unexpected Apps Script error.' });
  }
}

function parseRequest_(e, method) {
  const parameterPayload = e && e.parameter && e.parameter.payload ? safeJsonParse_(e.parameter.payload, {}) : {};
  const rawBody = e && e.postData && e.postData.contents ? safeJsonParse_(e.postData.contents, {}) : {};
  const params = Object.assign({}, (e && e.parameter) || {}, rawBody, parameterPayload);
  const endpoint = String(params.endpoint || 'health').replace(/^\/+/, '').replace(/^api\//, '');

  return {
    method: method,
    endpoint: endpoint,
    params: params,
    adminKey: params.adminKey || ''
  };
}

function routeRequest_(request) {
  switch (request.endpoint) {
    case 'health':
      return { ok: true, settings: getSettings_(), mode: 'apps-script' };
    case 'bootstrap':
      return {
        thresholds: getThresholds_(),
        settings: getSettings_(),
        pendingEmails: getPendingEmails_(),
        mode: 'apps-script',
        remainingDailyEmailQuota: MailApp.getRemainingDailyQuota()
      };
    case 'students':
      return getStudentById_(request.params.studentId || request.params.id || '');
    case 'scans':
      assertMethod_(request, 'POST');
      return recordScan_(request.params);
    case 'pending-emails':
      if (request.method === 'GET') {
        return getPendingEmails_();
      }
      return queuePendingEmail_(request.params);
    case 'pending-emails/clear':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      clearSheetData_(SHEETS.pendingEmails, pendingHeaders_());
      return { ok: true };
    case 'send-email':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      return sendParentEmail_(request.params);
    case 'settings':
      return getSettings_();
    case 'settings/email-home':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      return saveSettings_({ email_home_enabled: toBoolean_(request.params.enabled) });
    case 'sections/new':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      return startNewSection_();
    case 'thresholds':
      return getThresholds_();
    default:
      throw new Error('Unknown endpoint: ' + request.endpoint);
  }
}

function assertMethod_(request, expected) {
  if (request.method !== expected) {
    throw new Error('Method not allowed for endpoint ' + request.endpoint);
  }
}

function assertAdmin_(request) {
  const adminKey = getAdminKey_();
  if (!adminKey || request.adminKey !== adminKey) {
    throw new Error('Admin key is missing or incorrect.');
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSheetId_());
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
}

function getAdminKey_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || DEFAULT_ADMIN_KEY;
}

function getSchoolName_() {
  return PropertiesService.getScriptProperties().getProperty('SCHOOL_NAME') || DEFAULT_SCHOOL_NAME;
}

function getOrCreateSheet_(name, headers) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getRecords_(sheetName, headers) {
  const sheet = getOrCreateSheet_(sheetName, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const headerValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, headerValues.length).getValues();
  return values.map(function(row) {
    const record = {};
    headerValues.forEach(function(header, index) {
      record[String(header || '').trim()] = row[index];
    });
    return record;
  }).filter(function(record) {
    return Object.keys(record).some(function(key) {
      return String(record[key] || '').trim() !== '';
    });
  });
}

function appendRow_(sheetName, headers, row) {
  const sheet = getOrCreateSheet_(sheetName, headers);
  sheet.appendRow(row);
}

function clearSheetData_(sheetName, headers) {
  const sheet = getOrCreateSheet_(sheetName, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function overwriteSheet_(sheetName, headers, rows) {
  const sheet = getOrCreateSheet_(sheetName, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function studentHeaders_() {
  return ['student_id', 'first_name', 'last_name', 'class_year', 'team', 'parent_email'];
}

function scanHeaders_() {
  return ['timestamp', 'student_id', 'name', 'class_year', 'team', 'scan_number', 'parent_email', 'device_name', 'section', 'scan_date', 'client_event_id'];
}

function thresholdHeaders_() {
  return ['min', 'max', 'r', 'g', 'b', 'title'];
}

function pendingHeaders_() {
  return ['timestamp', 'student_id', 'name', 'parent_email', 'total_count', 'tier', 'reason', 'status'];
}

function sentHeaders_() {
  return ['timestamp', 'student_id', 'name', 'parent_email', 'total_count', 'tier', 'subject', 'status'];
}

function settingsHeaders_() {
  return ['key', 'value'];
}

function getStudents_() {
  return getRecords_(SHEETS.students, studentHeaders_());
}

function normalizeStudentId_(value) {
  const normalized = String(value || '').trim().replace(/^0+/, '');
  return normalized || '0';
}

function getStudentById_(studentId) {
  const target = normalizeStudentId_(studentId);
  const student = getStudents_().find(function(record) {
    return normalizeStudentId_(record.student_id) === target;
  });
  if (!student) {
    throw new Error('Student not found.');
  }
  return sanitizeStudent_(student);
}

function sanitizeStudent_(student) {
  return {
    student_id: String(student.student_id || ''),
    first_name: String(student.first_name || ''),
    last_name: String(student.last_name || ''),
    class_year: String(student.class_year || ''),
    team: String(student.team || ''),
    parent_email: String(student.parent_email || '')
  };
}

function getThresholds_() {
  const rows = getRecords_(SHEETS.thresholds, thresholdHeaders_());
  if (rows.length === 0) {
    overwriteSheet_(SHEETS.thresholds, thresholdHeaders_(), DEFAULT_THRESHOLDS.map(function(threshold) {
      return [threshold.min, threshold.max, threshold.color[0], threshold.color[1], threshold.color[2], threshold.title];
    }));
    return DEFAULT_THRESHOLDS.map(decorateThreshold_);
  }

  return rows.map(function(row) {
    return decorateThreshold_({
      min: Number(row.min || 0),
      max: Number(row.max || 0),
      color: [Number(row.r || 0), Number(row.g || 0), Number(row.b || 0)],
      title: String(row.title || 'Tier')
    });
  });
}

function decorateThreshold_(threshold) {
  const color = threshold.color || [1, 1, 1];
  return {
    min: Number(threshold.min || 0),
    max: Number(threshold.max || 0),
    color: color,
    title: String(threshold.title || 'Tier'),
    hex: rgbToHex_(color)
  };
}

function getSettings_() {
  const rows = getRecords_(SHEETS.settings, settingsHeaders_());
  if (rows.length === 0) {
    overwriteSheet_(SHEETS.settings, settingsHeaders_(), Object.keys(DEFAULT_SETTINGS).map(function(key) {
      return [key, JSON.stringify(DEFAULT_SETTINGS[key])];
    }));
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  return rows.reduce(function(accumulator, row) {
    accumulator[String(row.key)] = safeJsonParse_(row.value, row.value);
    return accumulator;
  }, {});
}

function saveSettings_(patch) {
  const nextSettings = Object.assign({}, getSettings_(), patch);
  overwriteSheet_(SHEETS.settings, settingsHeaders_(), Object.keys(nextSettings).map(function(key) {
    return [key, JSON.stringify(nextSettings[key])];
  }));
  return nextSettings;
}

function getPendingEmails_() {
  return getRecords_(SHEETS.pendingEmails, pendingHeaders_()).sort(function(left, right) {
    return String(right.timestamp || '').localeCompare(String(left.timestamp || ''));
  }).map(function(record) {
    return {
      timestamp: String(record.timestamp || ''),
      student_id: String(record.student_id || ''),
      name: String(record.name || ''),
      parent_email: String(record.parent_email || ''),
      total_count: Number(record.total_count || 0),
      tier: String(record.tier || ''),
      reason: String(record.reason || ''),
      status: String(record.status || 'pending')
    };
  });
}

function queuePendingEmail_(params) {
  const student = sanitizeStudent_(params.student || params);
  const reason = String(params.reason || 'Queued manually from the web app.');
  const tier = params.student && params.student.threshold && params.student.threshold.title ? params.student.threshold.title : String(params.tier || 'Manual Review');
  const totalCount = Number((params.student && params.student.total_count) || params.total_count || 0);
  upsertPendingEmail_({
    timestamp: new Date().toISOString(),
    student_id: student.student_id,
    name: student.first_name + ' ' + student.last_name,
    parent_email: student.parent_email,
    total_count: totalCount,
    tier: tier,
    reason: reason,
    status: 'pending'
  });
  return { ok: true };
}

function upsertPendingEmail_(record) {
  const rows = getPendingEmails_().filter(function(item) {
    return normalizeStudentId_(item.student_id) !== normalizeStudentId_(record.student_id);
  });
  rows.unshift(record);
  overwriteSheet_(SHEETS.pendingEmails, pendingHeaders_(), rows.map(function(item) {
    return [item.timestamp, item.student_id, item.name, item.parent_email, item.total_count, item.tier, item.reason, item.status];
  }));
}

function removePendingEmail_(studentId) {
  const rows = getPendingEmails_().filter(function(item) {
    return normalizeStudentId_(item.student_id) !== normalizeStudentId_(studentId);
  });
  overwriteSheet_(SHEETS.pendingEmails, pendingHeaders_(), rows.map(function(item) {
    return [item.timestamp, item.student_id, item.name, item.parent_email, item.total_count, item.tier, item.reason, item.status];
  }));
}

function getSentEmails_() {
  return getRecords_(SHEETS.sentEmails, sentHeaders_()).sort(function(left, right) {
    return String(right.timestamp || '').localeCompare(String(left.timestamp || ''));
  });
}

function appendSentEmail_(record) {
  appendRow_(SHEETS.sentEmails, sentHeaders_(), [record.timestamp, record.student_id, record.name, record.parent_email, record.total_count, record.tier, record.subject, record.status]);
}

function getScanRows_() {
  return getRecords_(SHEETS.scans, scanHeaders_());
}

function recordScan_(params) {
  const student = getStudentById_(params.studentId);
  const settings = getSettings_();
  const thresholds = getThresholds_();
  const scanRows = getScanRows_();
  const currentSection = Number(settings.current_section || 1);
  const today = todayKey_();
  const clientEventId = String(params.clientEventId || '');

  if (clientEventId) {
    const existingEvent = scanRows.find(function(row) {
      return String(row.client_event_id || '') === clientEventId;
    });
    if (existingEvent) {
      const totalCount = Number(existingEvent.scan_number || 0);
      const threshold = thresholdForCount_(thresholds, totalCount);
      return {
        duplicate: false,
        alreadyProcessed: true,
        currentSection: currentSection,
        student: decorateStudent_(student, totalCount, threshold),
        scan: {
          timestamp: String(existingEvent.timestamp || ''),
          section: Number(existingEvent.section || currentSection),
          synced: true,
          client_event_id: clientEventId
        }
      };
    }
  }

  const duplicate = scanRows.some(function(row) {
    return normalizeStudentId_(row.student_id) === normalizeStudentId_(student.student_id)
      && String(row.section || currentSection) === String(currentSection)
      && String(row.scan_date || '').slice(0, 10) === today;
  });
  const previousCount = scanRows.filter(function(row) {
    return normalizeStudentId_(row.student_id) === normalizeStudentId_(student.student_id);
  }).length;
  const totalCount = duplicate ? previousCount : previousCount + 1;
  const threshold = thresholdForCount_(thresholds, totalCount || 1);

  if (duplicate) {
    return {
      duplicate: true,
      currentSection: currentSection,
      student: decorateStudent_(student, totalCount, threshold)
    };
  }

  const timestamp = new Date().toISOString();
  appendRow_(SHEETS.scans, scanHeaders_(), [
    timestamp,
    student.student_id,
    student.first_name + ' ' + student.last_name,
    student.class_year,
    student.team,
    totalCount,
    student.parent_email,
    String(params.deviceName || 'web'),
    currentSection,
    today,
    clientEventId
  ]);

  let pendingEmailQueued = false;
  if (toBoolean_(settings.email_home_enabled) && String(threshold.title).trim().toLowerCase() === 'email home') {
    pendingEmailQueued = true;
    upsertPendingEmail_({
      timestamp: timestamp,
      student_id: student.student_id,
      name: student.first_name + ' ' + student.last_name,
      parent_email: student.parent_email,
      total_count: totalCount,
      tier: threshold.title,
      reason: threshold.title + ' reached at ' + totalCount + ' violations.',
      status: 'pending'
    });
  }

  return {
    duplicate: false,
    pendingEmailQueued: pendingEmailQueued,
    currentSection: currentSection,
    student: decorateStudent_(student, totalCount, threshold),
    scan: {
      timestamp: timestamp,
      section: currentSection,
      synced: true,
      client_event_id: clientEventId
    }
  };
}

function decorateStudent_(student, totalCount, threshold) {
  const cleanStudent = sanitizeStudent_(student);
  cleanStudent.total_count = totalCount;
  cleanStudent.threshold = threshold;
  return cleanStudent;
}

function thresholdForCount_(thresholds, totalCount) {
  return thresholds.find(function(threshold) {
    return totalCount >= Number(threshold.min) && totalCount <= Number(threshold.max);
  }) || thresholds[thresholds.length - 1];
}

function startNewSection_() {
  const current = getSettings_();
  const nextSection = Number(current.current_section || 1) + 1;
  return saveSettings_({
    current_section: nextSection,
    last_reset_time: new Date().toISOString()
  });
}

function sendParentEmail_(params) {
  const student = sanitizeStudent_(params.student || params);
  const totalCount = Number((params.student && params.student.total_count) || params.totalCount || 0);
  const tierTitle = params.student && params.student.threshold && params.student.threshold.title ? params.student.threshold.title : String(params.tier || 'Email Home');
  const generated = buildParentEmail_(student, totalCount, tierTitle);
  const to = String(params.to || student.parent_email || '');
  if (!to) {
    throw new Error('Parent email address is required.');
  }

  const subject = String(params.subject || generated.subject);
  const body = String(params.body || generated.body);
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    name: getSchoolName_() + ' Administration'
  });

  appendSentEmail_({
    timestamp: new Date().toISOString(),
    student_id: student.student_id,
    name: student.first_name + ' ' + student.last_name,
    parent_email: to,
    total_count: totalCount,
    tier: tierTitle,
    subject: subject,
    status: 'sent'
  });
  removePendingEmail_(student.student_id);
  return { ok: true, subject: subject, body: body };
}

function buildParentEmail_(student, totalCount, tierTitle) {
  const fullName = student.first_name + ' ' + student.last_name;
  return {
    subject: fullName + ' Lanyard Policy Notice (' + totalCount + ' total Lanyard Violations)',
    body: [
      'Good afternoon,',
      '',
      'This message is to inform you that ' + fullName + ' has reached ' + totalCount + ' recorded lanyard violations in our system.',
      '',
      'This places them in ' + (tierTitle || 'a new tier') + ' of our lanyard policy.',
      'Team: ' + (student.team || ''),
      'Class Year: ' + (student.class_year || ''),
      '',
      'We kindly ask for your support in reinforcing the importance of adhering to our lanyard policy to ensure a safe and secure environment for all students.',
      '',
      'Thank you for your partnership,',
      getSchoolName_() + ' Administration'
    ].join('\n')
  };
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function safeJsonParse_(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function rgbToHex_(color) {
  return '#' + color.map(function(part) {
    return Math.max(0, Math.min(255, Math.round(Number(part) * 255))).toString(16).padStart(2, '0');
  }).join('');
}

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toBoolean_(value) {
  return [true, 'true', '1', 1, 'yes', 'on'].indexOf(value) !== -1;
}
