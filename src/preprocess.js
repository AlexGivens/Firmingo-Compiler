import { validateBuildRequest, validateDeclaredPackagingRequest } from "./contract.js";
import { sha256, dataIdentity } from "./hash.js";
import { PipelineError, checkCancellation } from "./pipeline-error.js";
import { LIMITS } from "./limits.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const digit = value => value >= 48 && value <= 57 || value >= 65 && value <= 70 || value >= 97 && value <= 102;

function separator(bytes, index) {
  if (index === 0 || index + 1 >= bytes.length || !digit(bytes[index - 1]) || !digit(bytes[index + 1])) return false;
  let start = index - 1;
  while (start > 0 && (digit(bytes[start - 1]) || [88, 120, 39].includes(bytes[start - 1]))) start--;
  return bytes[start] >= 48 && bytes[start] <= 57;
}

function rawEnd(bytes, start) {
  let opening = start + 2;
  while (opening < bytes.length && opening - start - 2 <= 16 && bytes[opening] !== 40) {
    if (bytes[opening] <= 32 || [41, 92, 127].includes(bytes[opening])) return null;
    opening++;
  }
  if (opening >= bytes.length || bytes[opening] !== 40 || opening - start - 2 > 16) return null;
  const suffix = [41, ...bytes.subarray(start + 2, opening), 34];
  for (let index = opening + 1; index + suffix.length <= bytes.length; index++) {
    if (bytes[index] === 41 && suffix.every((byte, offset) => bytes[index + offset] === byte)) return index + suffix.length;
  }
  return bytes.length;
}

/** Equal-byte masks retain line/column positions while hiding comments and ordinary/raw literals. */
function masks(bytes, signal) {
  const code = bytes.slice(), comments = bytes.slice();
  const blank = (target, start, end) => {
    for (let index = start; index < end; index++) if (bytes[index] !== 10) target[index] = 32;
  };
  let index = 0;
  while (index < bytes.length) {
    if (index % 4096 === 0) checkCancellation(signal, "preprocessing");
    const next = bytes[index + 1];
    if (bytes[index] === 47 && [47, 42].includes(next)) {
      const start = index; index += 2;
      if (next === 47) while (index < bytes.length && bytes[index] !== 10) index++;
      else {
        while (index + 1 < bytes.length && !(bytes[index] === 42 && bytes[index + 1] === 47)) index++;
        index = Math.min(index + 2, bytes.length);
      }
      blank(code, start, index); blank(comments, start, index); continue;
    }
    if (bytes[index] === 82 && next === 34) {
      const end = rawEnd(bytes, index);
      if (end !== null) { blank(code, index, end); index = end; continue; }
    }
    if ([34, 39].includes(bytes[index])) {
      const start = index, quote = bytes[index];
      if (quote === 39 && separator(bytes, index)) { index++; continue; }
      index++;
      while (index < bytes.length) {
        if (bytes[index] === 92) { index = Math.min(index + 2, bytes.length); continue; }
        if (bytes[index++] === quote) break;
      }
      blank(code, start, index); continue;
    }
    index++;
  }
  return { code, comments };
}

function diagnostic(request, line, column, code, message, bomBytes) {
  return { severity: "error", stage: "preprocessing", code, message,
    filename: request.source.filename, line, column: column + (line === 1 ? bomBytes : 0) };
}

/** Produces mapped C++ input with original/generated identity, without parsing C++ or executing a compiler. */
export async function prepareSketch(input, { signal } = {}) {
  checkCancellation(signal, "preprocessing");
  const request = validateBuildRequest(input);
  return prepareValidatedSketch(request, signal);
}

/** Same source policy for a separately validated packaging declaration; never a compiler execution request. */
export async function preparePackagingSketch(input, { signal } = {}) {
  checkCancellation(signal, "preprocessing");
  return prepareValidatedSketch(validateDeclaredPackagingRequest(input), signal);
}

async function prepareValidatedSketch(request, signal) {
  const original = request.source.text;
  const bomBytes = original.startsWith("\ufeff") ? 3 : 0;
  const normalized = original.replace(/\r\n?/g, "\n").replace(/^\ufeff/, "");
  if (normalized.trim().length === 0) throw new PipelineError("invalid_source", "preprocessing", "Source has no code after normalization");
  const continuation = normalized.indexOf("\\\n");
  if (continuation !== -1) {
    const before = normalized.slice(0, continuation).split("\n");
    throw new PipelineError("unsupported_source", "preprocessing", "Escaped physical newlines are unavailable", [
      diagnostic(request, before.length, encoder.encode(before.at(-1)).length + 1, "line_splicing",
        "Write source without escaped physical newlines.", bomBytes),
    ]);
  }
  const masked = masks(encoder.encode(normalized), signal);
  const codeLines = decoder.decode(masked.code).split("\n");
  const commentLines = decoder.decode(masked.comments).split("\n");
  const diagnostics = [];
  for (const [index, line] of codeLines.entries()) {
    if (!/^\s*#/.test(line)) continue;
    if (/^[ \t]*#[ \t]*include[ \t]*(<Arduino\.h>|"Arduino\.h")[ \t]*$/.test(commentLines[index])) continue;
    const column = encoder.encode(line.slice(0, line.indexOf("#"))).length + 1;
    diagnostics.push(diagnostic(request, index + 1, column, "unsupported_directive",
      "Use only a literal Arduino.h include; macros, libraries and location overrides are unavailable.", bomBytes));
    if (diagnostics.length === 64) break;
  }
  if (diagnostics.length) throw new PipelineError("unsupported_source", "preprocessing", "Unsupported source directives", diagnostics);
  let translationUnit = `#include <Arduino.h>\n#line 1 "${request.source.filename}"\n` + normalized;
  if (!translationUnit.endsWith("\n")) translationUnit += "\n";
  checkCancellation(signal, "preprocessing");
  const [sourceSHA256, translationUnitSHA256, requestSHA256] = await Promise.all([
    sha256(encoder.encode(original)), sha256(encoder.encode(translationUnit)), dataIdentity(request),
  ]);
  checkCancellation(signal, "preprocessing");
  return Object.freeze({ request, sourceSHA256, translationUnit, translationUnitSHA256, requestSHA256,
    sourceLineCount: codeLines.length, sourceBOMBytes: bomBytes });
}

/** Maps physical generated-file positions; #line-remapped compiler positions must not be mapped twice. */
export function originalSourceLocation(prepared, generatedLine, byteColumn = 1) {
  if (!prepared || !Number.isSafeInteger(prepared.sourceLineCount) || prepared.sourceLineCount < 1
      || ![0, 3].includes(prepared.sourceBOMBytes) || typeof prepared.request?.source?.filename !== "string") return null;
  if (!Number.isSafeInteger(generatedLine) || !Number.isSafeInteger(byteColumn) || byteColumn < 1
      || byteColumn > LIMITS.sourceBytes + 1
      || generatedLine < 3 || generatedLine > prepared.sourceLineCount + 2) return null;
  const line = generatedLine - 2;
  return Object.freeze({ filename: prepared.request.source.filename, line,
    column: byteColumn + (line === 1 ? prepared.sourceBOMBytes : 0) });
}
