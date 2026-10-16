const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function checkPassword(password) {
  if (password.length < 12) {
    throw new Error('Password must have at least 12 characters');
  }
  return true;
}

function recordFailedLogin(account, now = Date.now()) {
  const failed = account.failedAttempts + 1;
  const lockedUntil = failed >= MAX_ATTEMPTS ? now + LOCK_MINUTES * 60 * 1000 : null;
  return { ...account, failedAttempts: failed, lockedUntil };
}

function canLogin(account, now = Date.now()) {
  return !account.lockedUntil || account.lockedUntil <= now;
}

module.exports = { checkPassword, recordFailedLogin, canLogin };
