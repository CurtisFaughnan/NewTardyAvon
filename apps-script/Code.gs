const DEFAULT_SHEET_ID = '1RnnPmQITQtevn04cMKw_PMflLr7jbAeDJ3PfXZaBDwE';
const DEFAULT_SCHOOL_NAME = 'Avon North Middle School';
const DEFAULT_ADMIN_KEY = 'AvonNorth';
const DEFAULT_APP_TITLE = 'Lanyard Tracker';
const DEFAULT_COUNT_LABEL = 'Total violations';
const DEFAULT_INCIDENT_SINGULAR = 'violation';
const DEFAULT_INCIDENT_PLURAL = 'violations';
const SHEET_DEFAULTS = {
  students: 'Lanyard_Data',
  scans: 'lanyard_log',
  thresholds: 'Thresholds',
  pendingEmails: 'Pending_Emails',
  sentEmails: 'Sent_Emails',
  settings: 'App_Settings'
};
const TARDY_SHEET_DEFAULTS = {
  students: 'Students',
  scans: 'scan_log',
  thresholds: 'Thresholds',
  pendingEmails: 'Pending_Emails',
  sentEmails: 'Sent_Emails',
  settings: 'App_Settings'
};
const SHEET_PROPERTY_KEYS = {
  students: 'STUDENTS_SHEET_NAME',
  scans: 'SCANS_SHEET_NAME',
  thresholds: 'THRESHOLDS_SHEET_NAME',
  pendingEmails: 'PENDING_EMAILS_SHEET_NAME',
  sentEmails: 'SENT_EMAILS_SHEET_NAME',
  settings: 'SETTINGS_SHEET_NAME'
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
  var request;
  try {
    request = parseRequest_(e, method);
    maintainScanSheet_(request);
    const data = routeRequest_(request);
    return jsonResponse_(data, request.callback);
  } catch (error) {
    return jsonResponse_({ error: error.message || 'Unexpected Apps Script error.' }, request && request.callback);
  }
}

function parseRequest_(e, method) {
  const parameterPayload = e && e.parameter && e.parameter.payload ? safeJsonParse_(e.parameter.payload, {}) : {};
  const rawBody = e && e.postData && e.postData.contents ? safeJsonParse_(e.postData.contents, {}) : {};
  const params = Object.assign({}, (e && e.parameter) || {}, rawBody, parameterPayload);
  const endpoint = String(params.endpoint || 'health').replace(/^\/+/, '').replace(/^api\//, '');
  const callback = sanitizeJsonpCallback_(params.callback || '');
  const effectiveMethod = String(params._method || method || 'GET').toUpperCase();

  return {
    method: effectiveMethod,
    endpoint: endpoint,
    params: params,
    adminKey: params.adminKey || '',
    callback: callback
  };
}

function routeRequest_(request) {
  switch (request.endpoint) {
    case 'health':
      return Object.assign({ ok: true, settings: getSettings_(), mode: 'apps-script' }, getClientConfig_());
    case 'bootstrap':
      return Object.assign({
        thresholds: getThresholds_(),
        settings: getSettings_(),
        pendingEmails: getPendingEmails_(),
        mode: 'apps-script',
        remainingDailyEmailQuota: MailApp.getRemainingDailyQuota()
      }, getClientConfig_());
    case 'students':
      if (request.method === 'GET') {
        return getStudentById_(request.params.studentId || request.params.id || '');
      }
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      return addStudent_(request.params.student || request.params);
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
      clearSheetData_(getSheetName_('pendingEmails'), pendingHeaders_());
      return { ok: true };
    case 'pending-emails/delete':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      removePendingEmail_(request.params.studentId || request.params.student_id || request.params.id || '');
      return { ok: true };
    case 'scans/repair-highlights':
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      refreshDailyHighlights_();
      PropertiesService.getScriptProperties().setProperty('LAST_DAILY_HIGHLIGHT_RESET', todayKey_());
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
      if (request.method === 'GET') {
        return getThresholds_();
      }
      assertMethod_(request, 'POST');
      assertAdmin_(request);
      return saveThresholds_(request.params.thresholds || []);
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
  const configuredSheetId = getSheetId_();
  if (configuredSheetId) {
    return SpreadsheetApp.openById(configuredSheetId);
  }

  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    return activeSpreadsheet;
  }

  return SpreadsheetApp.openById(DEFAULT_SHEET_ID);
}

function getSheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
}

function getAdminKey_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || DEFAULT_ADMIN_KEY;
}

function getSchoolName_() {
  return PropertiesService.getScriptProperties().getProperty('SCHOOL_NAME') || DEFAULT_SCHOOL_NAME;
}

function getAppTitle_() {
  return PropertiesService.getScriptProperties().getProperty('APP_TITLE') || DEFAULT_APP_TITLE;
}

function getCountLabel_() {
  return PropertiesService.getScriptProperties().getProperty('COUNT_LABEL') || DEFAULT_COUNT_LABEL;
}

function getIncidentSingular_() {
  return PropertiesService.getScriptProperties().getProperty('INCIDENT_SINGULAR') || DEFAULT_INCIDENT_SINGULAR;
}

function getIncidentPlural_() {
  return PropertiesService.getScriptProperties().getProperty('INCIDENT_PLURAL') || DEFAULT_INCIDENT_PLURAL;
}

function getClientConfig_() {
  return {
    schoolName: getSchoolName_(),
    appTitle: getAppTitle_(),
    countLabel: getCountLabel_(),
    incidentSingular: getIncidentSingular_(),
    incidentPlural: getIncidentPlural_()
  };
}

function getProgramLabel_() {
  const label = String(getAppTitle_() || '').trim();
  return label || 'Student Tracker';
}

function normalizeHeaderName_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonicalHeaderName_(header) {
  const normalized = normalizeHeaderName_(header);
  const aliases = {
    student_id: ['studentid', 'studentnumber', 'studentno', 'id'],
    first_name: ['firstname', 'fname', 'first'],
    last_name: ['lastname', 'lname', 'last'],
    class_year: ['classyear', 'gradeyear', 'grade', 'year'],
    team: ['teamname', 'team'],
    parent_email: ['parentemail', 'guardianemail', 'parentguardianemail', 'email', 'emailaddress'],
    scan_number: ['scannumber', 'scancount', 'totalcount', 'count'],
    device_name: ['devicename', 'device'],
    scan_date: ['scandate', 'date'],
    client_event_id: ['clienteventid', 'eventid']
  };

  if (!normalized) {
    return '';
  }

  for (var canonical in aliases) {
    if (normalizeHeaderName_(canonical) === normalized || aliases[canonical].indexOf(normalized) !== -1) {
      return canonical;
    }
  }

  if (normalized.indexOf('email') !== -1) {
    return 'parent_email';
  }

  return String(header || '').trim();
}

function getSheetName_(key) {
  const propertyKey = SHEET_PROPERTY_KEYS[key];
  if (!propertyKey) {
    throw new Error('Unknown sheet key: ' + key);
  }

  return PropertiesService.getScriptProperties().getProperty(propertyKey) || getDefaultSheetName_(key);
}

function getDefaultSheetName_(key) {
  if (isTardyTracker_()) {
    return TARDY_SHEET_DEFAULTS[key] || SHEET_DEFAULTS[key];
  }
  return SHEET_DEFAULTS[key];
}

function isTardyTracker_() {
  return /tardy/i.test(getAppTitle_() + ' ' + getIncidentSingular_() + ' ' + getIncidentPlural_());
}

function getOrCreateSheet_(name, headers) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (name !== getSheetName_('students')) {
    ensureHeaders_(sheet, headers);
  }

  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsUpdate = headers.some(function(header, index) {
    return String(existing[index] || '').trim() !== header;
  });

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
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
      const rawHeader = String(header || '').trim();
      const canonicalHeader = canonicalHeaderName_(rawHeader);
      if (rawHeader) {
        record[rawHeader] = row[index];
      }
      if (canonicalHeader) {
        const hasExistingValue = String(record[canonicalHeader] || '').trim() !== '';
        const hasNextValue = String(row[index] || '').trim() !== '';
        if (!hasExistingValue || hasNextValue) {
          record[canonicalHeader] = row[index];
        }
      }
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
  SpreadsheetApp.flush();
  return {
    sheet: sheet,
    rowIndex: sheet.getLastRow()
  };
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
  return getRecords_(getSheetName_('students'), studentHeaders_());
}

function getSheetHeaders_(sheet, fallbackHeaders) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn > 0) {
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
      return String(header || '').trim();
    });
    if (headers.some(function(header) { return header; })) {
      return headers;
    }
  }

  sheet.getRange(1, 1, 1, fallbackHeaders.length).setValues([fallbackHeaders]);
  return fallbackHeaders.slice();
}

function getStudentSheetHeaders_() {
  const sheet = getOrCreateSheet_(getSheetName_('students'), studentHeaders_());
  return getSheetHeaders_(sheet, studentHeaders_());
}

function normalizeStudentId_(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (/^\d+(\.0+)?$/.test(raw)) {
    return String(parseInt(raw, 10));
  }
  const normalized = raw.replace(/^0+/, '');
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

function sanitizeStudentInput_(student) {
  const normalized = {
    student_id: String(student.student_id || student.studentId || '').trim().replace(/^0+/, ''),
    first_name: String(student.first_name || student.firstName || '').trim(),
    last_name: String(student.last_name || student.lastName || '').trim(),
    class_year: String(student.class_year || student.classYear || student.grade || '').trim(),
    team: String(student.team || '').trim(),
    parent_email: String(student.parent_email || student.parentEmail || student.email || '').trim()
  };

  if (!normalized.student_id) {
    throw new Error('Student ID is required.');
  }
  if (!normalized.first_name) {
    throw new Error('First name is required.');
  }
  if (!normalized.last_name) {
    throw new Error('Last name is required.');
  }
  if (!normalized.class_year) {
    throw new Error('Class year is required.');
  }
  if (normalized.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.parent_email)) {
    throw new Error('Parent email must be valid or blank.');
  }

  return normalized;
}

function studentValueForHeader_(student, header) {
  switch (canonicalHeaderName_(header)) {
    case 'student_id':
      return student.student_id;
    case 'first_name':
      return student.first_name;
    case 'last_name':
      return student.last_name;
    case 'class_year':
      return student.class_year;
    case 'team':
      return student.team;
    case 'parent_email':
      return student.parent_email;
    default:
      return '';
  }
}

function addStudent_(student) {
  const sanitized = sanitizeStudentInput_(student || {});
  const existing = getStudents_().find(function(record) {
    return normalizeStudentId_(record.student_id) === normalizeStudentId_(sanitized.student_id);
  });
  if (existing) {
    throw new Error('A student with that ID already exists.');
  }

  const headers = getStudentSheetHeaders_().map(function(header) {
    return String(header || '').trim();
  });
  const missingHeaders = ['student_id', 'first_name', 'last_name', 'class_year'].filter(function(header) {
    return headers.map(canonicalHeaderName_).indexOf(header) === -1;
  });
  if (missingHeaders.length > 0) {
    throw new Error('Students sheet is missing required columns: ' + missingHeaders.join(', '));
  }

  appendRow_(getSheetName_('students'), headers, headers.map(function(header) {
    return studentValueForHeader_(sanitized, header);
  }));

  return sanitizeStudent_(sanitized);
}

function getThresholds_() {
  const rows = getRecords_(getSheetName_('thresholds'), thresholdHeaders_());
  if (rows.length === 0) {
    overwriteSheet_(getSheetName_('thresholds'), thresholdHeaders_(), DEFAULT_THRESHOLDS.map(function(threshold) {
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

function saveThresholds_(thresholds) {
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    throw new Error('At least one threshold is required.');
  }

  var normalized = thresholds.map(function(threshold, index) {
    var title = String(threshold.title || '').trim();
    var min = Number(threshold.min);
    var max = Number(threshold.max);
    var hex = String(threshold.hex || '').trim();
    if (!title) {
      throw new Error('Tier ' + (index + 1) + ' needs a title.');
    }
    if (!isFinite(min) || !isFinite(max)) {
      throw new Error('Tier ' + (index + 1) + ' needs valid min and max values.');
    }
    if (max < min) {
      throw new Error('Tier ' + (index + 1) + ' has a max lower than its min.');
    }
    if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) {
      throw new Error('Tier ' + (index + 1) + ' needs a valid 6-digit color.');
    }

    return {
      title: title,
      min: Math.trunc(min),
      max: Math.trunc(max),
      hex: hex.charAt(0) === '#' ? hex.toLowerCase() : ('#' + hex.toLowerCase())
    };
  });

  normalized.forEach(function(threshold, index) {
    if (index > 0 && threshold.min <= normalized[index - 1].max) {
      throw new Error('Tier ' + (index + 1) + ' overlaps the previous tier.');
    }
  });

  overwriteSheet_(getSheetName_('thresholds'), thresholdHeaders_(), normalized.map(function(threshold) {
    var color = hexToRgb_(threshold.hex);
    return [threshold.min, threshold.max, color[0], color[1], color[2], threshold.title];
  }));

  refreshDailyHighlights_();
  return getThresholds_();
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
  const rows = getRecords_(getSheetName_('settings'), settingsHeaders_());
  if (rows.length === 0) {
    overwriteSheet_(getSheetName_('settings'), settingsHeaders_(), Object.keys(DEFAULT_SETTINGS).map(function(key) {
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
  overwriteSheet_(getSheetName_('settings'), settingsHeaders_(), Object.keys(nextSettings).map(function(key) {
    return [key, JSON.stringify(nextSettings[key])];
  }));
  return nextSettings;
}

function getPendingEmails_() {
  return mergeDerivedPendingEmails_(readPendingEmailRows_()).sort(function(left, right) {
    return String(right.timestamp || '').localeCompare(String(left.timestamp || ''));
  });
}

function readPendingEmailRows_() {
  return getRecords_(getSheetName_('pendingEmails'), pendingHeaders_()).map(normalizePendingEmailRecord_);
}

function normalizePendingEmailRecord_(record) {
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
}

function mergeDerivedPendingEmails_(pendingRows) {
  const rows = pendingRows.slice();
  const existingIds = rows.reduce(function(accumulator, row) {
    accumulator[normalizeStudentId_(row.student_id)] = true;
    return accumulator;
  }, {});
  const sentRows = getSentEmails_();
  const studentsById = getStudents_().reduce(function(accumulator, student) {
    accumulator[normalizeStudentId_(student.student_id)] = student;
    return accumulator;
  }, {});
  const scanGroups = getScanRows_().reduce(function(accumulator, row) {
    const rawStudentId = String(row.student_id || '').trim();
    if (!rawStudentId) {
      return accumulator;
    }

    const studentId = normalizeStudentId_(rawStudentId);
    if (!accumulator[studentId]) {
      accumulator[studentId] = {
        count: 0,
        maxScanNumber: 0,
        latest: null
      };
    }

    const group = accumulator[studentId];
    const scanNumber = Number(row.scan_number || 0);
    group.count += 1;
    group.maxScanNumber = Math.max(group.maxScanNumber, Number.isFinite(scanNumber) ? scanNumber : 0);
    if (!group.latest || String(row.timestamp || '').localeCompare(String(group.latest.timestamp || '')) > 0) {
      group.latest = row;
    }
    return accumulator;
  }, {});
  const thresholds = getThresholds_();

  Object.keys(scanGroups).forEach(function(studentId) {
    if (existingIds[studentId] || hasSentEmailHome_(sentRows, studentId)) {
      return;
    }

    const group = scanGroups[studentId];
    const totalCount = Math.max(group.count, group.maxScanNumber);
    const emailHomeThreshold = emailHomeThresholdForCount_(thresholds, totalCount);
    if (!emailHomeThreshold) {
      return;
    }

    const latest = group.latest || {};
    const student = studentsById[studentId] || {};
    const fullName = String(latest.name || (student.first_name + ' ' + student.last_name) || '').trim();
    rows.push({
      timestamp: String(latest.timestamp || new Date().toISOString()),
      student_id: String(latest.student_id || student.student_id || studentId),
      name: fullName,
      parent_email: String(latest.parent_email || student.parent_email || ''),
      total_count: totalCount,
      tier: emailHomeThreshold.title || 'Email Home',
      reason: 'Email Home reached at ' + totalCount + ' ' + getIncidentPlural_() + '.',
      status: 'pending'
    });
  });

  return rows;
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
  const rows = readPendingEmailRows_().filter(function(item) {
    return normalizeStudentId_(item.student_id) !== normalizeStudentId_(record.student_id);
  });
  rows.unshift(record);
  overwriteSheet_(getSheetName_('pendingEmails'), pendingHeaders_(), rows.map(function(item) {
    return [item.timestamp, item.student_id, item.name, item.parent_email, item.total_count, item.tier, item.reason, item.status];
  }));
}

function removePendingEmail_(studentId) {
  const rows = readPendingEmailRows_().filter(function(item) {
    return normalizeStudentId_(item.student_id) !== normalizeStudentId_(studentId);
  });
  overwriteSheet_(getSheetName_('pendingEmails'), pendingHeaders_(), rows.map(function(item) {
    return [item.timestamp, item.student_id, item.name, item.parent_email, item.total_count, item.tier, item.reason, item.status];
  }));
}

function getSentEmails_() {
  return getRecords_(getSheetName_('sentEmails'), sentHeaders_()).sort(function(left, right) {
    return String(right.timestamp || '').localeCompare(String(left.timestamp || ''));
  });
}

function appendSentEmail_(record) {
  appendRow_(getSheetName_('sentEmails'), sentHeaders_(), [record.timestamp, record.student_id, record.name, record.parent_email, record.total_count, record.tier, record.subject, record.status]);
}

function getScanRows_() {
  return getRecords_(getSheetName_('scans'), scanHeaders_());
}

function maintainScanSheet_(request) {
  const properties = PropertiesService.getScriptProperties();
  const today = todayKey_();
  const lastReset = properties.getProperty('LAST_DAILY_HIGHLIGHT_RESET') || '';
  if (lastReset === today && !shouldRefreshDailyHighlights_(request)) {
    return;
  }

  refreshDailyHighlights_();
  properties.setProperty('LAST_DAILY_HIGHLIGHT_RESET', today);
}

function clearDailyHighlights_() {
  const sheet = getOrCreateSheet_(getSheetName_('scans'), scanHeaders_());
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), scanHeaders_().length)).setBackground('#ffffff');
}

function shouldRefreshDailyHighlights_(request) {
  if (!request || !request.endpoint) {
    return true;
  }

  return request.endpoint === 'bootstrap'
    || request.endpoint === 'health'
    || request.endpoint === 'thresholds';
}

function refreshDailyHighlights_() {
  const sheet = getOrCreateSheet_(getSheetName_('scans'), scanHeaders_());
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const columnCount = Math.max(sheet.getLastColumn(), scanHeaders_().length);
  const headers = sheet.getRange(1, 1, 1, columnCount).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });
  const values = sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
  const thresholds = getThresholds_();
  const today = todayKey_();
  const white = '#ffffff';
  const backgrounds = values.map(function(row) {
    const record = {};
    headers.forEach(function(header, index) {
      const value = row[index];
      const canonicalHeader = canonicalHeaderName_(header);
      record[header] = value;
      if (canonicalHeader) {
        record[canonicalHeader] = value;
      }
    });

    const totalCount = Number(record.scan_number || 0);
    const isToday = readScanDate_(record) === today;
    const hex = isToday && totalCount > 0 ? getThresholdHex_(thresholdForCount_(thresholds, totalCount)) : white;

    return Array(columnCount).fill(hex);
  });

  sheet.getRange(2, 1, values.length, columnCount).setBackgrounds(backgrounds);
  SpreadsheetApp.flush();
}

function runDailyHighlightReset() {
  refreshDailyHighlights_();
  PropertiesService.getScriptProperties().setProperty('LAST_DAILY_HIGHLIGHT_RESET', todayKey_());
}

function repairTodayHighlights() {
  refreshDailyHighlights_();
}

function installNightlyResetTrigger() {
  removeTriggersForFunction_('runDailyHighlightReset');
  ScriptApp.newTrigger('runDailyHighlightReset')
    .timeBased()
    .atHour(0)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(Session.getScriptTimeZone())
    .create();
}

function removeNightlyResetTrigger() {
  removeTriggersForFunction_('runDailyHighlightReset');
}

function removeTriggersForFunction_(functionName) {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
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
      && Number(readScanSection_(row)) === currentSection
      && readScanDate_(row) === today;
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
  const appended = appendRow_(getSheetName_('scans'), scanHeaders_(), [
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
  const appliedColor = colorScanRow_(appended.sheet, appended.rowIndex, threshold);
  PropertiesService.getScriptProperties().setProperty('LAST_DAILY_HIGHLIGHT_RESET', today);

  let pendingEmailQueued = false;
  if (toBoolean_(settings.email_home_enabled) && isEmailHomeTitle_(threshold.title) && !hasSentEmailHome_(getSentEmails_(), student.student_id)) {
    pendingEmailQueued = true;
    upsertPendingEmail_({
      timestamp: timestamp,
      student_id: student.student_id,
      name: student.first_name + ' ' + student.last_name,
      parent_email: student.parent_email,
      total_count: totalCount,
      tier: threshold.title,
      reason: threshold.title + ' reached at ' + totalCount + ' ' + getIncidentPlural_() + '.',
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
      client_event_id: clientEventId,
      row_index: appended.rowIndex,
      sheet_color: appliedColor
    }
  };
}

function decorateStudent_(student, totalCount, threshold) {
  const cleanStudent = sanitizeStudent_(student);
  cleanStudent.total_count = totalCount;
  cleanStudent.threshold = threshold;
  return cleanStudent;
}

function readScanSection_(row) {
  const raw = row.section;
  if (raw === null || raw === '' || typeof raw === 'undefined') {
    return 1;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readScanDate_(row) {
  const explicitDate = String(row.scan_date || '').slice(0, 10);
  if (explicitDate) {
    return explicitDate;
  }

  const timestamp = String(row.timestamp || '').trim();
  const match = timestamp.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function thresholdForCount_(thresholds, totalCount) {
  return thresholds.find(function(threshold) {
    return totalCount >= Number(threshold.min) && totalCount <= Number(threshold.max);
  }) || thresholds[thresholds.length - 1];
}

function isEmailHomeTitle_(title) {
  return /email\s*home/i.test(String(title || ''));
}

function emailHomeThresholdForCount_(thresholds, totalCount) {
  return thresholds.filter(function(threshold) {
    return isEmailHomeTitle_(threshold.title) && totalCount >= Number(threshold.min || 0);
  }).sort(function(left, right) {
    return Number(right.min || 0) - Number(left.min || 0);
  })[0] || null;
}

function hasSentEmailHome_(sentRows, studentId) {
  const normalizedId = normalizeStudentId_(studentId);
  return sentRows.some(function(row) {
    return normalizeStudentId_(row.student_id) === normalizedId && isEmailHomeTitle_(row.tier || row.subject);
  });
}

function colorScanRow_(sheet, rowIndex, threshold) {
  const columnCount = Math.max(sheet.getLastColumn(), scanHeaders_().length);
  const hex = getThresholdHex_(threshold);
  sheet.getRange(rowIndex, 1, 1, columnCount).setBackgrounds([Array(columnCount).fill(hex)]);
  SpreadsheetApp.flush();
  return hex;
}

function getThresholdHex_(threshold) {
  if (!threshold) {
    return '#ffffff';
  }
  const explicitHex = String(threshold.hex || '').trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(explicitHex)) {
    return explicitHex.charAt(0) === '#' ? explicitHex.toLowerCase() : ('#' + explicitHex.toLowerCase());
  }
  return rgbToHex_(threshold.color || [1, 1, 1]);
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
  const incidentPlural = getIncidentPlural_();
  const programLabel = getProgramLabel_();
  const isTardyProgram = /tardy/i.test(programLabel) || /\btard(?:y|ies)\b/i.test(getIncidentSingular_() + ' ' + incidentPlural);
  if (isTardyProgram) {
    const tardySweepLabel = totalCount + ' tardy sweep' + (totalCount === 1 ? '' : 's');
    return {
      subject: fullName + ' ' + programLabel + ' Notice (' + totalCount + ' total ' + incidentPlural + ')',
      body: [
        'Good afternoon,',
        '',
        'This message is to inform you that ' + fullName + ' has been caught in ' + tardySweepLabel + '.',
        'This places them in the ' + (tierTitle || 'Email Home') + ' tier of our tardy tracker.',
        '',
        'Thank you,',
        getSchoolName_() + ' Administration'
      ].join('\n')
    };
  }

  return {
    subject: fullName + ' ' + programLabel + ' Notice (' + totalCount + ' total ' + incidentPlural + ')',
    body: [
      'Good afternoon,',
      '',
      'This message is to inform you that ' + fullName + ' has reached ' + totalCount + ' recorded ' + incidentPlural + ' in our system.',
      '',
      'This places them in ' + (tierTitle || 'a new tier') + ' of our ' + programLabel.toLowerCase() + ' process.',
      'Team: ' + (student.team || ''),
      'Class Year: ' + (student.class_year || ''),
      '',
      'We kindly ask for your support in reinforcing the importance of following school expectations in this area.',
      '',
      'Thank you for your partnership,',
      getSchoolName_() + ' Administration'
    ].join('\n')
  };
}

function jsonResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeJsonpCallback_(value) {
  const callback = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback) ? callback : '';
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

function hexToRgb_(hex) {
  var clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [1, 1, 1];
  }

  return [0, 2, 4].map(function(index) {
    return parseInt(clean.slice(index, index + 2), 16) / 255;
  });
}

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function toBoolean_(value) {
  return [true, 'true', '1', 1, 'yes', 'on'].indexOf(value) !== -1;
}
