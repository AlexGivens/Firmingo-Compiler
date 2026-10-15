import { PipelineError, checkCancellation, snapshotBytes } from "./pipeline-error.js";

export const CODE_ADDRESS = 0x10200100;
export const MAXIMUM_CODE_BYTES = 3840;
export const MAXIMUM_ELF_BYTES = 2 * 1024 * 1024;
const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const aligned = value => value === 0 || value <= 65536 && (value & (value - 1)) === 0;

/** Parses only the pinned stateless ARM ELF subset; architecture headers do not attest instruction/ABI behavior. */
export function parseELF(input, { signal, state } = {}) {
  if (state && (!Number.isInteger(state.stateAddress) || !Number.isInteger(state.stateCapacityBytes)
      || state.stateAddress % 4 || state.stateCapacityBytes % 4 || state.stateCapacityBytes < 4 || state.stateCapacityBytes > 4096
      || state.stateAddress < 0x20000000 || state.stateAddress > 0x20042000 - state.stateCapacityBytes))
    throw new PipelineError("invalid_elf", "validating", "Invalid explicit resident state arena");
  checkCancellation(signal, "validating");
  const bytes = snapshotBytes(input, 52, MAXIMUM_ELF_BYTES, "validating", "invalid_elf");
  const fail = message => { throw new PipelineError("invalid_elf", "validating", message); };
  const range = (start, count) => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count < 0
        || start > bytes.length || count > bytes.length - start) fail("Truncated or overflowing ELF range");
    return { start, end: start + count };
  };
  const view = new DataView(bytes.buffer);
  const u16 = offset => { range(offset, 2); return view.getUint16(offset, true); };
  const u32 = offset => { range(offset, 4); return view.getUint32(offset, true); };
  const ident = [127, 69, 76, 70, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!ident.every((value, index) => bytes[index] === value) || u16(16) !== 2 || u16(18) !== 40
      || u32(20) !== 1 || ![0x05000000, 0x05000200].includes(u32(36)) || u16(40) !== 52) {
    fail("Require little-endian ARM ELF32 ET_EXEC, base/soft EABI five");
  }
  const phOffset = u32(28), shOffset = u32(32), phCount = u16(44), shCount = u16(48), namesIndex = u16(50);
  if (u16(42) !== 32 || u16(46) !== 40 || phCount < 1 || phCount > 16 || shCount < 2 || shCount > 128
      || namesIndex < 1 || namesIndex >= shCount || phOffset < 52 || shOffset < 52 || phOffset % 4 || shOffset % 4) {
    fail("Invalid or extended ELF header tables");
  }
  const programTable = range(phOffset, phCount * 32), sectionTable = range(shOffset, shCount * 40);
  if (overlaps(programTable, sectionTable)) fail("Overlapping ELF metadata tables");
  const sections = [];
  for (let index = 0; index < shCount; index++) {
    const offset = shOffset + index * 40;
    const values = Array.from({ length: 10 }, (_, field) => u32(offset + field * 4));
    const [name, type, flags, address, fileOffset, size, link, info, alignment, entrySize] = values;
    sections.push({ name, type, flags, address, offset: fileOffset, size, link, info, alignment, entrySize, values });
  }
  if (!sections[0].values.every(value => value === 0) || sections[namesIndex].type !== 3 || sections[namesIndex].flags !== 0) {
    fail("Invalid null section or section-name table");
  }
  const stringTable = section => {
    const table = range(section.offset, section.size);
    if (!section.size || bytes[table.start] !== 0 || bytes[table.end - 1] !== 0) fail("Invalid ELF string table");
    return table;
  };
  const string = (table, offset) => {
    if (offset >= table.end - table.start) fail("ELF string offset outside table");
    const start = table.start + offset, limit = Math.min(table.end, start + 257);
    let end = start;
    while (end < limit && bytes[end] !== 0) end++;
    if (end === limit) fail("Unterminated or oversized ELF string");
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(start, end)); }
    catch { fail("Invalid UTF-8 ELF name"); }
  };
  const names = stringTable(sections[namesIndex]);
  let textIndex = null, symbolIndex = null, dataIndex = null, bssIndex = null;
  for (let index = 1; index < shCount; index++) {
    const section = sections[index], name = string(names, section.name);
    if (!aligned(section.alignment)) fail("Invalid ELF section alignment");
    if (section.type !== 8) range(section.offset, section.size);
    if ([4, 6, 9, 11, 14, 15, 16].includes(section.type) && section.size) fail("Relocations, dynamic linkage and initializers are unavailable");
    if ((section.flags & 2) && section.size) {
      if (state && [".data", ".bss"].includes(name)) {
        if (section.type !== (name === ".data" ? 1 : 8) || section.flags !== 3 || section.size % 4
            || section.address % 4 || section.address % Math.max(section.alignment, 1)) fail("Invalid state section");
        if (name === ".data") { if (dataIndex !== null) fail("Duplicate .data"); dataIndex = index; }
        else { if (bssIndex !== null) fail("Duplicate .bss"); bssIndex = index; }
      } else {
        if (name !== ".text" || section.type !== 1 || ![6, 0x36].includes(section.flags)
            || section.address !== CODE_ADDRESS || section.size > MAXIMUM_CODE_BYTES || section.size % 4
            || textIndex !== null || section.address % Math.max(section.alignment, 1)) fail("Require one readonly .text and only explicitly supported state sections");
        textIndex = index;
      }
    }
    if (section.type === 2) {
      if (symbolIndex !== null || section.flags || section.entrySize !== 16 || !section.size || section.size % 16
          || section.size / 16 > 4096 || section.link < 1 || section.link >= shCount
          || sections[section.link].type !== 3 || sections[section.link].flags || section.info > section.size / 16) fail("Invalid static ELF symbol table");
      symbolIndex = index;
    }
  }
  if (textIndex === null || symbolIndex === null) fail("Missing .text or static entry symbols");
  const text = sections[textIndex], codeRange = range(text.offset, text.size), codeEnd = text.address + text.size;
  if (text.offset < 52 || overlaps(codeRange, programTable) || overlaps(codeRange, sectionTable)) fail("Code overlaps ELF metadata");
  for (let index = 0; index < shCount; index++) {
    const section = sections[index];
    if (index !== textIndex && section.type !== 8 && section.size && overlaps(codeRange, range(section.offset, section.size))) fail("Code overlaps another section");
  }
  const data = dataIndex === null ? null : sections[dataIndex], bss = bssIndex === null ? null : sections[bssIndex];
  const dataBytes = data?.size ?? 0, bssBytes = bss?.size ?? 0;
  if (state && (dataBytes + bssBytes > state.stateCapacityBytes || text.size + dataBytes > MAXIMUM_CODE_BYTES
      || data && data.address !== state.stateAddress || bss && bss.address !== state.stateAddress + dataBytes)) fail("State exceeds or disagrees with exact resident arena");
  if (data) {
    const extent = range(data.offset, data.size);
    if (data.offset < 52 || overlaps(extent, programTable) || overlaps(extent, sectionTable)) fail("Data overlaps ELF metadata");
    for (let index = 0; index < shCount; index++) {
      const section = sections[index];
      if (index !== dataIndex && section.type !== 8 && section.size && overlaps(extent, range(section.offset, section.size))) fail("Data overlaps another section");
    }
  }
  const loads = [];
  let stateMapped = false;
  let mapped = false;
  for (let index = 0; index < phCount; index++) {
    checkCancellation(signal, "validating");
    const offset = phOffset + index * 32;
    const [type, fileOffset, address, physical, fileSize, memorySize, flags, alignment] = Array.from({ length: 8 }, (_, field) => u32(offset + field * 4));
    if (type === 0 || type === 0x6474e551 && !fileSize && !memorySize && !(flags & 1)) continue;
    if (state) {
      if (type !== 1 || !aligned(alignment) || alignment && fileOffset % alignment !== address % alignment) fail("Unsupported stateful program header");
      range(fileOffset, fileSize);
      if (flags === 5 && address === text.address && physical === text.address && fileOffset === text.offset
          && fileSize === text.size && memorySize === text.size && !mapped) { mapped = true; continue; }
      if (flags === 6 && address === state.stateAddress && physical === codeEnd && fileSize === dataBytes
          && memorySize === dataBytes + bssBytes && (!data || fileOffset === data.offset) && !stateMapped) { stateMapped = true; continue; }
      fail("LOAD mapping must match exact code/data/BSS, including flash load address");
    }
    if (![1, 6].includes(type) || memorySize !== fileSize || !fileSize || address !== physical || ![4, 5].includes(flags)
        || address < CODE_ADDRESS - 256 || address + fileSize > codeEnd || !aligned(alignment)
        || alignment && fileOffset % alignment !== address % alignment) fail("Unsupported program header, writable memory or load range");
    range(fileOffset, fileSize);
    const memory = { start: address, end: address + fileSize };
    if (type === 6) {
      if (memory.end > text.address || fileOffset !== phOffset || fileSize !== programTable.end - programTable.start) fail("Invalid mapped program-header metadata");
      continue;
    }
    if (loads.some(load => overlaps(load, memory))) fail("Overlapping ELF LOAD ranges");
    loads.push(memory);
    if (text.address >= memory.start && codeEnd <= memory.end) {
      if (flags !== 5 || text.offset < fileOffset || text.offset - fileOffset !== text.address - address) fail("ELF .text and executable LOAD mapping disagree");
      mapped = true;
    }
  }
  if (state && dataBytes + bssBytes && !stateMapped) fail("Missing state LOAD mapping");
  if (!mapped) fail("Code has no executable LOAD mapping");
  const symbols = sections[symbolIndex], strings = stringTable(sections[symbols.link]);
  if (!bytes.subarray(symbols.offset, symbols.offset + 16).every(value => value === 0)) fail("Invalid null ELF symbol");
  const entries = new Map();
  for (let index = 0; index < symbols.size / 16; index++) {
    if (index % 256 === 0) checkCancellation(signal, "validating");
    const offset = symbols.offset + index * 16;
    const name = string(strings, u32(offset)), value = u32(offset + 4), size = u32(offset + 8);
    const info = bytes[offset + 12], other = bytes[offset + 13], section = u16(offset + 14);
    if (info >> 4 > 2 || (info & 15) > 4 || other > 3 || section === 0xfff2 || name.length && section === 0
        || !(section < shCount || section === 0xfff1)) fail("Undefined, common or extended ELF symbol");
    if (!["firmingo_sketch_setup", "firmingo_sketch_loop"].includes(name)) continue;
    const instruction = value - value % 2;
    if (entries.has(name) || info !== 0x12 || other !== 0 || section !== textIndex || value % 2 !== 1 || !size
        || instruction < text.address || instruction + size > codeEnd) fail("Entry must be a unique global Thumb function within .text");
    entries.set(name, value);
  }
  const setupAddress = entries.get("firmingo_sketch_setup"), loopAddress = entries.get("firmingo_sketch_loop");
  if (setupAddress === undefined || loopAddress === undefined || u32(24) !== setupAddress) fail("Missing wrappers or mismatched ELF setup entry");
  checkCancellation(signal, "validating");
  const code = bytes.slice(codeRange.start, codeRange.end);
  return Object.freeze({ get code() { return code.slice(); }, ...(state ? { get data() { return data ? bytes.slice(data.offset, data.offset + data.size) : new Uint8Array(); }, dataBytes, bssBytes } : {}), codeBytes: code.length, setupAddress, loopAddress });
}
