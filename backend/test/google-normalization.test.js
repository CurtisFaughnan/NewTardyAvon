const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sourcePath = path.join(__dirname, "..", "src", "google.js");
const source = `${fs.readFileSync(sourcePath, "utf8")}
module.exports.__test = {
  canonicalHeaderName,
  normalizeStudentId,
  sanitizeStudentInput,
  studentValueForHeader
};`;

const sandbox = {
  require(name) {
    if (name === "googleapis") {
      return { google: {} };
    }
    if (name === "./config") {
      return { config: {} };
    }
    throw new Error(`Unexpected require: ${name}`);
  },
  module: { exports: {} },
  exports: {}
};

vm.runInNewContext(source, sandbox, { filename: sourcePath });

const {
  canonicalHeaderName,
  normalizeStudentId,
  sanitizeStudentInput,
  studentValueForHeader
} = sandbox.module.exports.__test;

assert.strictEqual(canonicalHeaderName("Student ID"), "student_id");
assert.strictEqual(canonicalHeaderName("First Name"), "first_name");
assert.strictEqual(canonicalHeaderName("Parent Email"), "parent_email");
assert.strictEqual(canonicalHeaderName("Guardian Email"), "parent_email");
assert.strictEqual(normalizeStudentId("00123.0"), "123");

const student = sanitizeStudentInput({
  studentId: "00123.0",
  firstName: "Ada",
  lastName: "Lovelace",
  grade: "8",
  email: "parent@example.com"
});

assert.strictEqual(student.student_id, "123");
assert.strictEqual(student.class_year, "8");
assert.strictEqual(student.parent_email, "parent@example.com");
assert.strictEqual(studentValueForHeader(student, "Guardian Email"), "parent@example.com");

console.log("google normalization tests passed");
