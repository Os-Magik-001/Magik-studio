// Supabase rejects passwords over 72 bytes; the studio asks for at least 8 characters.
export const MIN_PASSWORD = 8;

export function passwordProblem(password: unknown) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `Passwords need at least ${MIN_PASSWORD} characters.`;
  }
  if (password.length > 72) return "Passwords can be at most 72 characters.";
  return null;
}
