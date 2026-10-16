function isAdmin(user) {
  return user.roles.includes('admin');
}

module.exports = { isAdmin };
