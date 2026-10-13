import { openSync, fstatSync, readSync, closeSync, constants } from "node:fs";

/** Copies at most an explicit cap plus one byte; FIFOs and directories are rejected without blocking. */
export function readBounded(path, maximum = 2 * 1024 * 1024) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const facts = fstatSync(descriptor);
    if (!facts.isFile() || facts.size > maximum) throw new Error("Input must be a bounded regular file");
    const buffer = Buffer.alloc(maximum + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > maximum) throw new Error("Input file grew beyond the byte limit");
    return new Uint8Array(buffer.subarray(0, length));
  } finally { closeSync(descriptor); }
}
