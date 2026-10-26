// What people see when something fails: never the AI service's raw error (a status code, its
// JSON and a request id), only what it means for them. Other messages pass through as they are.
// The edit engine keeps its own copy (engine/src/errors.ts).

const RAW = /\b\d{3} \{"type":"error"[\s\S]*$/;

export function friendlyError(message: string): string;
export function friendlyError(message: string | null | undefined): string | null;
export function friendlyError(message: string | null | undefined) {
  if (!message) return message ?? null;
  if (/credit balance is too low/i.test(message)) return "Not enough credits.";
  if (!message.includes('"type":"error"')) return message;
  if (/overloaded_error|"api_error"/.test(message)) return "The AI is busy right now. Try again in a few minutes.";
  if (/rate_limit_error/.test(message)) return "Too many requests right now. Try again in a minute.";
  if (/authentication_error|permission_error/.test(message)) return "The AI isn't connected right now.";
  // Anything else: the service's own sentence, after what the app was doing.
  const inner = message.match(/"error":\{"type":"[a-z_]+","message":"((?:[^"\\]|\\.)*)"/)?.[1];
  let meaning = "The AI couldn't answer.";
  try {
    if (inner) meaning = JSON.parse(`"${inner}"`);
  } catch {}
  const before = message.replace(RAW, "").trim().replace(/[:\s]+$/, "");
  return before ? `${before}: ${meaning}` : meaning;
}
