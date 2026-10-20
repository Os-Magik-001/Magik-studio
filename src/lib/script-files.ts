import "server-only";
import mammoth from "mammoth";
import { extractTextItems } from "unpdf";
import WordExtractor from "word-extractor";

// Reads a script someone already wrote (a PDF, a Word document or a text file) into the plain
// text the script fields hold. Tables come out one row per line with the cells separated by
// " | ", so a two-column video/audio script keeps each row together. Nothing is stored.

export class ScriptFileError extends Error {}

// A reel or episode script is a few thousand characters; much more is the wrong file.
const MAX_CHARS = 60_000;

type Kind = "pdf" | "docx" | "doc" | "rtf" | "text";

const TEXT_EXTENSIONS = ["txt", "text", "md", "markdown", "fountain"];
const WORD_EXTENSIONS = ["docx", "docm", "dotx", "dotm"];

function kindOf(name: string, bytes: Uint8Array): Kind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  const starts = (...signature: number[]) => signature.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "doc"; // Word 97-2003
  if (starts(0x7b, 0x5c, 0x72, 0x74, 0x66)) return "rtf"; // {\rtf
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    // A zip: Word's format, or Pages, OpenDocument and the like.
    if (WORD_EXTENSIONS.includes(ext) || !ext) return "docx";
    throw new ScriptFileError(`.${ext} files can't be read here. Export it as a PDF or a Word document (.docx) and import that.`);
  }
  if (TEXT_EXTENSIONS.includes(ext) || !ext) return "text";
  throw new ScriptFileError("This file type can't be read here. Use a PDF, a Word document (.docx or .doc) or a text file (.txt, .md, .rtf).");
}

// ---------------------------------------------------------------- text files

// Windows-1252 by hand: Node's decoder reads 0x80-0x9F as control codes, losing — “ ” € and œ.
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];
function decodeCp1252(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCodePoint(...Array.from(bytes.subarray(i, i + 8192), (b) => (b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b)));
  }
  return text;
}

function decodeText(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Older Windows text files: accents in the Windows-1252 code page.
    return decodeCp1252(bytes);
  }
}

// ---------------------------------------------------------------- PDF

type Part = { x: number; end: number; str: string };
type Line = { y: number; size: number; parts: Part[] };

// A PDF page's text rebuilt from where each piece sits: pieces on the same baseline make a line,
// a table's column (an x where several lines start a piece after a wide gap) becomes " | ", and
// a tall gap between lines (a new scene, a heading) becomes a blank line.
function pageText(items: { str: string; x: number; y: number; width: number; fontSize: number }[]) {
  const pieces = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const i of pieces) {
    const line = lines.at(-1);
    const size = i.fontSize || 10;
    if (line && Math.abs(line.y - i.y) <= Math.min(line.size, size) * 0.4) {
      line.parts.push({ x: i.x, end: i.x + i.width, str: i.str });
      line.size = Math.max(line.size, size);
    } else lines.push({ y: i.y, size, parts: [{ x: i.x, end: i.x + i.width, str: i.str }] });
  }
  for (const line of lines) line.parts.sort((a, b) => a.x - b.x);

  // Column starts: x positions (to 2 points) where a piece opens after a wide gap on two or
  // more lines with different text before it, as in a table. Justified text has wide gaps
  // too, but they don't line up.
  const columns = new Map<number, Set<string>>();
  for (const line of lines) {
    line.parts.forEach((p, k) => {
      if (k === 0 || p.x - line.parts[k - 1].end <= line.size * 2) return;
      const key = Math.round(p.x / 2);
      columns.set(key, (columns.get(key) ?? new Set<string>()).add(line.parts.slice(0, k).map((q) => q.str).join("")));
    });
  }
  const isColumn = (x: number) => [-1, 0, 1].some((d) => (columns.get(Math.round(x / 2) + d)?.size ?? 0) >= 2);

  let out = "";
  lines.forEach((line, n) => {
    // A cell break is the only gap on its line, or clearly wider than the others: justified
    // text sets every word apart by the same gap, and a word can land on a column's x.
    const gaps = line.parts.slice(1).map((p, k) => p.x - line.parts[k].end).filter((g) => g > line.size * 0.1).sort((a, b) => a - b);
    const usual = gaps[Math.floor(gaps.length / 2)] ?? 0;
    const cellBreak = (gap: number) => gaps.length <= 2 || gap > usual * 1.5;
    let text = "";
    let end = -Infinity;
    for (const p of line.parts) {
      const gap = p.x - end;
      // A cell as wide as its column ends right at the next one: a column start needs no wide gap.
      if (text && gap > line.size * 0.1 && isColumn(p.x) && cellBreak(gap)) text = `${text.trimEnd()} | ${p.str.trimStart()}`;
      else if (text && gap > line.size * 0.15 && !text.endsWith(" ") && !p.str.startsWith(" ")) text += ` ${p.str}`;
      else text += p.str;
      end = Math.max(end, p.end);
    }
    const prev = lines[n - 1];
    if (prev && prev.y - line.y > Math.min(prev.size, line.size) * 2.2) out += "\n";
    out += `${text.trim()}\n`;
  });
  return out;
}

async function pdfText(bytes: Uint8Array) {
  try {
    const { items } = await extractTextItems(new Uint8Array(bytes));
    return items.map((page) => pageText(page).trim()).filter(Boolean).join("\n\n");
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") {
      throw new ScriptFileError("This PDF is protected by a password. Save a copy without it, then import that.");
    }
    throw new ScriptFileError("This PDF couldn't be opened. Export it again from the app that made it, or paste the text.");
  }
}

// ---------------------------------------------------------------- Word (.docx)

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );
const stripTags = (html: string) => html.replace(/<[^>]+>/g, "");

// Replaces the innermost element first (one with none of the same kind inside it), so nested
// lists and tables come out right. `tags` is a regex alternation such as "ul|ol".
function replaceInnermost(html: string, tags: string, convert: (inner: string, tag: string) => string) {
  const pattern = new RegExp(`<(${tags})\\b[^>]*>((?:(?!<(?:${tags})\\b)[\\s\\S])*?)</\\1>`, "i");
  for (let m = pattern.exec(html); m; m = pattern.exec(html)) {
    html = html.slice(0, m.index) + convert(m[2], m[1].toLowerCase()) + html.slice(m.index + m[0].length);
  }
  return html;
}

// The plain text of a bit of mammoth's HTML: one line per paragraph.
// Lines keep their leading spaces (a nested list item's indent); trailing ones go.
const paragraphs = (html: string) =>
  html
    .split(/<\/p>|<\/h[1-6]>|<br\s*\/?>/i)
    .map((p) => decodeEntities(stripTags(p)).trimEnd());
// Inside a list item or a table cell, every <p> starts a new line (a nested list's items too).
const innerParagraphs = (html: string) =>
  paragraphs(html.replace(/<p\b/gi, "</p><p"))
    .map((line) => line.trim())
    .filter(Boolean);
const asParagraphs = (lines: string[]) => lines.map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");

// mammoth's HTML is small and regular (p, h1-h6, ul/ol/li, table/tr/td, inline tags),
// so a few replacements turn it into script text.
function wordHtmlToText(html: string) {
  html = html.replace(/<img\b[^>]*>/gi, "");
  // Lists first, so a list inside a table cell keeps its items apart.
  html = replaceInnermost(html, "ul|ol", (inner, tag) => {
    const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(([, item], i) => {
      const [first = "", ...rest] = innerParagraphs(item);
      return [`${tag === "ol" ? `${i + 1}.` : "-"} ${first}`, ...rest.map((line) => `  ${line}`)];
    });
    return asParagraphs(items.flat());
  });
  html = replaceInnermost(html, "table", (inner) => {
    const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
      [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => innerParagraphs(cell).join(" ")).join(" | "),
    );
    return `<p></p>${asParagraphs(rows)}<p></p>`;
  });
  // A heading gets a blank line above it, like a scene heading.
  html = html.replace(/<h[1-6]\b[^>]*>/gi, "<p></p><p>");
  return paragraphs(html).join("\n");
}

async function docxText(bytes: Uint8Array) {
  try {
    const { value } = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      // Empty paragraphs are the writer's spacing; images are dropped.
      { ignoreEmptyParagraphs: false, convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
    );
    return wordHtmlToText(value);
  } catch {
    throw new ScriptFileError("This Word document couldn't be opened. Save it again as .docx, or export it as a PDF.");
  }
}

// ---------------------------------------------------------------- Word 97-2003 (.doc)

async function docText(bytes: Uint8Array) {
  try {
    // Table cells end with a tab; tidy() turns those lines into rows.
    return (await new WordExtractor().extract(Buffer.from(bytes))).getBody();
  } catch {
    throw new ScriptFileError("This Word document couldn't be opened. Save it again as .docx, or export it as a PDF.");
  }
}

// ---------------------------------------------------------------- RTF (TextEdit's default)

// Groups whose text is never shown: font and colour tables, document info, pictures, headers.
const RTF_HIDDEN = new Set([
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "header", "headerl", "headerr", "headerf",
  "footer", "footerl", "footerr", "footerf", "footnote", "listtable", "listoverridetable", "fldinst",
  "themedata", "colorschememapping", "latentstyles", "datastore", "xmlnstbl", "rsidtbl", "generator",
  "filetbl", "revtbl", "pgdsctbl", "bkmkstart", "bkmkend", "shpinst", "nonshppict", "annotation",
]);
const RTF_CHARS: Record<string, string> = {
  par: "\n", line: "\n", sect: "\n\n", page: "\n\n", tab: "\t", cell: "\t", row: "\n",
  emdash: "—", endash: "–", bullet: "•", lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”",
};

function rtfToText(rtf: string) {
  const pattern = /\\([a-z]{1,32})(-?\d{1,10})? ?|\\'([0-9a-f]{2})|\\([^a-z])|([{}])|[\r\n]+|(.)/gi;
  const stack: { skip: number; hidden: boolean }[] = [];
  let hidden = false;
  let ucSkip = 1;
  let toSkip = 0;
  let out = "";
  for (const [, word, arg, hex, symbol, brace, char] of rtf.matchAll(pattern)) {
    if (brace) {
      toSkip = 0;
      if (brace === "{") stack.push({ skip: ucSkip, hidden });
      else ({ skip: ucSkip, hidden } = stack.pop() ?? { skip: 1, hidden: false });
    } else if (symbol) {
      toSkip = 0;
      if (symbol === "*") hidden = true;
      else if (!hidden && symbol === "~") out += " ";
      else if (!hidden && "{}\\".includes(symbol)) out += symbol;
      // A backslash at the end of a source line is a paragraph break.
      else if (!hidden && (symbol === "\n" || symbol === "\r")) out += "\n";
    } else if (word) {
      toSkip = 0;
      if (RTF_HIDDEN.has(word)) hidden = true;
      else if (hidden) continue;
      else if (word in RTF_CHARS) out += RTF_CHARS[word];
      else if (word === "uc") ucSkip = Number(arg ?? 1);
      else if (word === "u") {
        const code = Number(arg);
        out += String.fromCharCode(code < 0 ? code + 0x10000 : code);
        toSkip = ucSkip;
      }
    } else if (hex) {
      if (toSkip > 0) toSkip--;
      else if (!hidden) out += decodeCp1252(new Uint8Array([parseInt(hex, 16)]));
    } else if (char) {
      if (toSkip > 0) toSkip--;
      else if (!hidden) out += char;
    }
  }
  return out;
}

// ---------------------------------------------------------------- all files

// Lines from .doc, RTF and TextEdit files: a table row's cells each end with a tab, and list
// items start with a marker between tabs ("\t•\t", "\t1\t").
const tableRow = (line: string) => (/\t\s*$/.test(line) ? line.split("\t").map((c) => c.trim()).filter(Boolean).join(" | ") : line);
const listItem = (line: string) => line.replace(/^\t?[•◦▪‣⁃]\t/, "- ").replace(/^\t?(\d{1,3})[.)]?\t/, "$1. ");

function tidy(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => listItem(tableRow(line)))
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The text of a script file, ready for the script field. Throws ScriptFileError with a
// message for the person importing it.
export async function readScript(name: string, bytes: Uint8Array): Promise<string> {
  const kind = kindOf(name, bytes);
  const raw =
    kind === "pdf" ? await pdfText(bytes)
    : kind === "docx" ? await docxText(bytes)
    : kind === "doc" ? await docText(bytes)
    : kind === "rtf" ? rtfToText(decodeText(bytes))
    : decodeText(bytes);
  // Binary bytes under a text extension decode to control characters.
  if (kind === "text" && (raw.match(/[\u0000-\u0008\u000e-\u001f]/g)?.length ?? 0) > raw.length / 100) {
    throw new ScriptFileError("This doesn't look like a text file. Use a PDF, a Word document or a .txt file.");
  }
  const text = tidy(raw);
  if (!text) {
    throw new ScriptFileError(
      kind === "pdf" ? "No text found in this PDF: it may be a scan. Export the script again as a PDF from Word or Google Docs, or paste it." : "This file has no text in it.",
    );
  }
  if (text.length > MAX_CHARS) throw new ScriptFileError(`This file holds ${text.length.toLocaleString("en-US")} characters of text, more than a script. Is it the right file?`);
  return text;
}
