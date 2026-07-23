/**
 * Whether patients can request a password reset online (the form at
 * /forgot-password: email + ID photo + note, reviewed by staff). When
 * disabled, patients have no online path to a new password at all — they
 * must contact the clinic directly (see CLINIC_PHONE in config.ts).
 *
 * Toggle with PASSWORD_RESET_REQUESTS_ENABLED in the environment ("true" or
 * "false"); defaults to enabled. Server-only — do not import from a "use
 * client" module.
 */
export function passwordResetRequestsEnabled(): boolean {
  return process.env.PASSWORD_RESET_REQUESTS_ENABLED !== "false";
}
