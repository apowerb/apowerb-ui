/**
 * Is this user an administrator?
 *
 * The API sends `role` from the backend enum's value — "ADMIN", upper case.
 * Two places compared it against "admin" and so never matched: the admin nav
 * group (with /supervision inside it) was invisible to everyone, and the
 * supervision page gated itself shut. The backend made the same mistake in
 * its own ownership checks (apowerb#70).
 *
 * Three copies of one comparison is how a convention gets lost, so this is
 * the only place the spelling is decided.
 */
export function isAdminRole(role) {
  return String(role ?? "").toUpperCase() === "ADMIN";
}

export function isAdminUser(user) {
  return isAdminRole(user?.role);
}
