/** Input hygiene for XSS and injection. React already escapes output; this keeps bad text out of storage too. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g; // control + bidi-override chars
const TAGS = /<\/?[a-zA-Z!][^>]*>?/g; // anything that looks like an HTML tag
const SCRIPT_URL = /\b(?:javascript|vbscript|data)\s*:/gi;

/** Strip control characters, HTML tags and script URLs, then cap the length. */
export function clean(v: unknown, max = 5000): string {
  return String(v ?? "").replace(CONTROL, "").replace(TAGS, "").replace(SCRIPT_URL, "").trim().slice(0, max);
}

/** Request body text: must be a string, non-empty, under the size limit. */
export function bodyText(v: unknown, max = 20000): string {
  if (typeof v !== "string") throw new HttpError(400, "Message text must be a string.");
  const t = clean(v, max + 1);
  if (!t) throw new HttpError(400, "Message is empty.");
  if (t.length > max) throw new HttpError(413, `Message is too long (max ${max} characters).`);
  return t;
}

/** Recursively clean every string in model output. Model text is untrusted too. */
export function cleanDeep<T>(x: T, max = 2000): T {
  if (typeof x === "string") return clean(x, max) as T;
  if (Array.isArray(x)) return x.map((i) => cleanDeep(i, max)) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [clean(k, 80), cleanDeep(v, max)])) as T;
  return x;
}

/** Spreadsheet formula injection guard for CSV cells. */
export const csvSafe = (v: unknown) => /^[=+\-@\t\r]/.test(String(v)) ? "'" + String(v) : String(v);
