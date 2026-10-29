/**
 * Mirrors Supabase Auth's `minimum_password_length = 8` and `password_requirements =
 * "letters_digits"`. Checking it here lets the form name the rule before Supabase
 * rejects the password with an error the candidate cannot read.
 */
export const PASSWORD_RULE = "Use at least 8 characters, including a letter and a number.";

export function meetsPasswordRule(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

/**
 * The candidate-facing reason when Supabase refuses a password, or null for any other
 * failure. Supabase also rejects passwords found in known breaches ("pwned") and, on a
 * reset, the password the account already has — neither of which the form can check.
 */
export function passwordRejection(error: unknown): string | null {
  const { code, reasons } = (error ?? {}) as { code?: unknown; reasons?: unknown };
  if (code === "same_password") return "Choose a password different from your current one.";
  if (code !== "weak_password") return null;
  if (Array.isArray(reasons) && reasons.includes("pwned")) {
    return "This password has appeared in a known data breach. Choose a different one.";
  }
  return PASSWORD_RULE;
}
