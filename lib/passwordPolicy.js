/**
 * One password policy shared by signup and reset. Pure functions so the rules
 * can be unit-tested without a database.
 */

// bcrypt silently ignores bytes past 72; refusing them is clearer than truncating.
const MAX_BYTES = 72;
const MIN_LENGTH = 8;

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "iloveyou",
  "admin123",
  "welcome1",
  "letmein1",
  "abc12345",
  "pakistan",
  "pakistan1",
  "familyfinance",
]);

function byteLength(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

/** Returns an error message, or null when the password is acceptable. */
function passwordProblem(password, { email = "" } = {}) {
  const value = String(password || "");
  if (value.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (byteLength(value) > MAX_BYTES) return "Password is too long. Use 72 bytes or fewer.";
  if (value.length === value.split("").filter((ch) => ch === value[0]).length) {
    return "Password cannot be a single repeated character.";
  }
  if (COMMON.has(value.toLowerCase())) return "Choose a less common password.";
  if (email && value.toLowerCase() === String(email).toLowerCase()) {
    return "Password cannot be the same as your email address.";
  }
  return null;
}

/** True when bcrypt can hash this value without silent truncation. */
function passwordFitsBcrypt(password) {
  return byteLength(password) <= MAX_BYTES;
}

module.exports = { passwordProblem, passwordFitsBcrypt, MIN_LENGTH, MAX_BYTES };
