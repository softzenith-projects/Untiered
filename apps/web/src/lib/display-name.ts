/**
 * What to call someone who has not told us their name.
 *
 * Google sign-in sends a name; an email-and-password signup sends nothing, and the pages
 * used to fall back to the raw address, so a profile headline read
 * "naman.kaushik06@gmail.com". A readable guess from the address is friendlier:
 * "Naman Kaushik".
 *
 * Display only. It is never saved as the account's name, so the profile still counts the
 * name as missing and keeps asking for the real one.
 */

/** "naman.kaushik06@gmail.com" → "Naman Kaushik"; null when the address gives nothing usable. */
export function nameFromEmail(email: string | null | undefined): string | null {
  const local = email?.split("@")[0]?.split("+")[0];
  if (!local) return null;
  const words = local
    .split(/[._-]+/)
    // Trailing digits are a birth year or a counter, not part of a name.
    .map((part) => part.replace(/\d+$/, ""))
    // Anything still holding a digit, or a lone letter, is not a word anyone goes by.
    .filter((part) => part.length > 1 && !/\d/.test(part));
  if (words.length === 0) return null;
  return words.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join(" ");
}

/** The name to show: the one they gave, else a guess from their email, else the email itself. */
export function displayNameFor(me: { displayName: string | null; email: string }): string {
  return me.displayName?.trim() || nameFromEmail(me.email) || me.email;
}
