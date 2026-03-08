const nodemailer = require("nodemailer");
const { config } = require("./config");

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }

  return transporter;
}

function buildParentEmail({ student, totalCount, tierTitle }) {
  const fullName = `${student.first_name} ${student.last_name}`;
  const subject = `${fullName} Lanyard Policy Notice (${totalCount} total Lanyard Violations)`;
  const body = [
    "Good afternoon,",
    "",
    `This message is to inform you that ${fullName} has reached ${totalCount} recorded lanyard violations in our system.`,
    "",
    `This places them in ${tierTitle || "a new tier"} of our lanyard policy.`,
    `Team: ${student.team || ""}`,
    `Class Year: ${student.class_year || ""}`,
    "",
    "We kindly ask for your support in reinforcing the importance of adhering to our lanyard policy to ensure a safe and secure environment for all students.",
    "",
    "Thank you for your partnership,",
    `${config.schoolName} Administration`
  ].join("\n");

  return { subject, body };
}

async function sendParentEmail({ to, subject, body }) {
  if (!config.smtp.user || !config.smtp.pass || !config.smtp.from) {
    throw new Error("SMTP settings are incomplete.");
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: body
  });
}

module.exports = {
  buildParentEmail,
  sendParentEmail
};
