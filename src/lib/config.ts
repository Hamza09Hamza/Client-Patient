/** Single source of truth for the clinic's display name — change once, everywhere updates. */
export const CLINIC_NAME = "Clinique Amina";

/**
 * How a patient reaches a human. Shown on the sign-in page, where
 * "contact the clinic to reset your password" is otherwise a dead end —
 * the one place in this app a locked-out patient can still be helped.
 *
 * Transcribed from cliniqueamina.com. `tel:` values are E.164 (no spaces or
 * parentheses) so phones dial them correctly; `display` is how the clinic
 * writes them. Verify against the clinic before launch.
 */
export const CLINIC_CONTACT = {
  addressLines: ["Lotissement Zone Est", "09250 Chiffa, Algérie"],
  phones: [
    { display: "+213 (0) 28 68 43 63", tel: "+21328684363" },
    { display: "+213 (0) 28 68 43 98", tel: "+21328684398" },
    { display: "+213 (0) 28 68 44 44", tel: "+21328684444" },
  ],
  mobile: { display: "+213 (0) 563 02 61 81", tel: "+213563026181" },
  email: "contact@cliniqueamina.com",
  website: "https://cliniqueamina.com",
} as const;
