export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  data?: Record<string, string>;
};

export const fail = (error: string): ActionResult => ({ error });
export const done = (message?: string, data?: Record<string, string>): ActionResult => ({
  ok: true,
  message,
  data,
});

export function text(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optionalText(formData: FormData, key: string) {
  return text(formData, key) || null;
}
