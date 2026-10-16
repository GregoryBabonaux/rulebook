function validateSignup(form) {
  if (form.password.length < 8) {
    throw new Error('Password must have at least 8 characters');
  }
  return { ...form };
}

module.exports = { validateSignup };
