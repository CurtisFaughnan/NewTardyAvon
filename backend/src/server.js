const cors = require("cors");
const express = require("express");
const { config } = require("./config");
const {
  addStudent,
  appendSentEmail,
  clearPendingEmails,
  getPendingEmails,
  getSentEmails,
  getSettings,
  getStudentById,
  getThresholds,
  recordScan,
  removePendingEmail,
  saveSettings,
  upsertPendingEmail
} = require("./google");
const { buildParentEmail, sendParentEmail } = require("./mail");

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || config.clientOrigins.length === 0 || config.clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS."));
  },
  credentials: false,
  allowedHeaders: ["Content-Type", "x-admin-key"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
app.use(express.json({ limit: "1mb" }));

function requireAdmin(req, res, next) {
  if (!config.adminKey) {
    res.status(503).json({ error: "ADMIN_KEY is not configured on the backend." });
    return;
  }
  if (req.get("x-admin-key") !== config.adminKey) {
    res.status(401).json({ error: "Admin key is missing or incorrect." });
    return;
  }
  next();
}

function getDeviceName(req) {
  return req.body.deviceName || req.get("x-device-name") || "web";
}

app.get("/api/health", async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ ok: true, settings });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", async (req, res, next) => {
  try {
    const [thresholds, settings, pendingEmails] = await Promise.all([
      getThresholds(),
      getSettings(),
      getPendingEmails()
    ]);
    res.json({ thresholds, settings, pendingEmails });
  } catch (error) {
    next(error);
  }
});

app.get("/api/students/:studentId", async (req, res, next) => {
  try {
    const student = await getStudentById(req.params.studentId);
    if (!student) {
      res.status(404).json({ error: "Student not found." });
      return;
    }
    res.json(student);
  } catch (error) {
    next(error);
  }
});

app.post("/api/students", requireAdmin, async (req, res, next) => {
  try {
    const student = req.body.student || req.body;
    res.status(201).json(await addStudent(student));
  } catch (error) {
    next(error);
  }
});

app.post("/api/scans", async (req, res, next) => {
  try {
    const studentId = String(req.body.studentId || "").trim();
    if (!studentId) {
      res.status(400).json({ error: "studentId is required." });
      return;
    }

    const result = await recordScan({
      studentId,
      deviceName: getDeviceName(req),
      clientEventId: req.body.clientEventId || ""
    });

    if (result.notFound) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/pending-emails", async (req, res, next) => {
  try {
    res.json(await getPendingEmails());
  } catch (error) {
    next(error);
  }
});

app.post("/api/pending-emails", async (req, res, next) => {
  try {
    const student = req.body.student;
    if (!student || !student.student_id) {
      res.status(400).json({ error: "student payload is required." });
      return;
    }

    await upsertPendingEmail({
      timestamp: new Date().toISOString(),
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      parent_email: student.parent_email || "",
      total_count: student.total_count || 0,
      tier: student.threshold && student.threshold.title ? student.threshold.title : "Manual Review",
      reason: req.body.reason || "Queued manually from the web app.",
      status: "pending"
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/pending-emails/clear", requireAdmin, async (req, res, next) => {
  try {
    await clearPendingEmails();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/pending-emails/:studentId", requireAdmin, async (req, res, next) => {
  try {
    await removePendingEmail(req.params.studentId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sent-emails", requireAdmin, async (req, res, next) => {
  try {
    res.json(await getSentEmails());
  } catch (error) {
    next(error);
  }
});

app.post("/api/send-email", requireAdmin, async (req, res, next) => {
  try {
    const student = req.body.student;
    if (!student || !student.student_id) {
      res.status(400).json({ error: "student payload is required." });
      return;
    }

    const tierTitle = student.threshold && student.threshold.title ? student.threshold.title : (req.body.tier || "Email Home");
    const totalCount = Number(student.total_count || req.body.totalCount || 0);
    const generated = buildParentEmail({ student, totalCount, tierTitle });
    const subject = req.body.subject || generated.subject;
    const body = req.body.body || generated.body;
    const to = req.body.to || student.parent_email;

    if (!to) {
      res.status(400).json({ error: "Parent email address is required." });
      return;
    }

    await sendParentEmail({ to, subject, body });
    await appendSentEmail({
      timestamp: new Date().toISOString(),
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      parent_email: to,
      total_count: totalCount,
      tier: tierTitle,
      subject,
      status: "sent"
    });
    await removePendingEmail(student.student_id);
    res.json({ ok: true, subject, body });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings/email-home", requireAdmin, async (req, res, next) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const settings = await saveSettings({ email_home_enabled: enabled });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.post("/api/sections/new", requireAdmin, async (req, res, next) => {
  try {
    const current = await getSettings();
    const nextSection = Number(current.current_section || 1) + 1;
    const settings = await saveSettings({
      current_section: nextSection,
      last_reset_time: new Date().toISOString()
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.get("/api/thresholds", async (req, res, next) => {
  try {
    res.json(await getThresholds());
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || "Unexpected server error." });
});

app.listen(config.port, () => {
  console.log(`Lanyard backend listening on port ${config.port}`);
});
