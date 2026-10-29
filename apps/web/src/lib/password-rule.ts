/**
 * Mirrors Supabase Auth's `minimum_password_length = 8` and `password_requirements =
 * "letters_digits"`. Checking it here lets the form name the rule before Supabase
 * rejects the password with an error the candidate cannot read.
 */
export const PASSWORD_RULE = "Use at least 8 characters, including a letter and a number.";

export function meetsPasswordRule(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
