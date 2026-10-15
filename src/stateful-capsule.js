import { sha256 } from "./hash.js";
import { PipelineError, checkCancellation, snapshotBytes } from "./pipeline-error.js";

const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
const digestBytes = hash => Uint8Array.from(hash.match(/../g), value => parseInt(value, 16));

/** Checks exact FMS2 spans and all resident RAM/API bindings independently of ELF and build reports. */
export async function validateStatefulCapsule(input, binding, signal) {
  const bytes = snapshotBytes(input, 260, binding.maximumCapsuleBytes, "validating", "invalid_capsule");
  const view = new DataView(bytes.buffer), u16 = offset => view.getUint16(offset, true), u32 = offset => view.getUint32(offset, true);
  const fail = message => { throw new PipelineError("invalid_capsule", "validating", message); };
  if (hex(bytes.subarray(0, 4)) !== "464d5332" || u16(4) !== 2 || u16(6) !== 128 || u32(8) !== 0x4f4e414e
      || u32(12) !== binding.apiAddress || u32(16) !== 0x10200100 || u32(56) || u32(60)
      || !bytes.subarray(128, 256).every(value => value === 0)) fail("Invalid FMS2 header, padding or API binding");
  const codeBytes = u32(20), setupAddress = u32(24), loopAddress = u32(28), dataBytes = u32(36), bssBytes = u32(44);
  const entry = value => value % 2 === 1 && value - 1 >= 0x10200100 && value - 1 - 0x10200100 <= codeBytes - 2;
  if (!codeBytes || codeBytes % 4 || dataBytes % 4 || bssBytes % 4 || !entry(setupAddress) || !entry(loopAddress)
      || dataBytes + bssBytes > binding.stateCapacityBytes || u32(32) !== binding.stateAddress
      || u32(40) !== binding.stateAddress + dataBytes || u32(48) !== 256 + codeBytes
      || u32(52) !== bytes.length || 256 + codeBytes + dataBytes !== bytes.length) fail("Invalid FMS2 lengths, entries or exact resident state binding");
  const [payloadSHA256, headerSHA256, codeSHA256, capsuleSHA256] = await Promise.all([
    sha256(bytes.subarray(256)), sha256(bytes.subarray(0, 96)), sha256(bytes.subarray(256, 256 + codeBytes)), sha256(bytes)]);
  if (hex(bytes.subarray(64, 96)) !== payloadSHA256 || hex(bytes.subarray(96, 128)) !== headerSHA256) fail("FMS2 header or payload digest mismatch");
  checkCancellation(signal, "validating");
  return Object.freeze({ codeBytes, setupAddress, loopAddress, dataBytes, bssBytes, codeSHA256, payloadSHA256, headerSHA256,
    capsuleSHA256, capsuleBytes: bytes.length });
}

/** Serializes only the independently validated linked sections; validates the completed capsule again. */
export async function createStatefulCapsule(image, binding, signal) {
  const code = image.code, data = image.data, bytes = new Uint8Array(256 + code.length + data.length), view = new DataView(bytes.buffer);
  bytes.set([70, 77, 83, 50]); view.setUint16(4, 2, true); view.setUint16(6, 128, true);
  for (const [offset, value] of [[8, 0x4f4e414e], [12, binding.apiAddress], [16, 0x10200100], [20, code.length],
    [24, image.setupAddress], [28, image.loopAddress], [32, binding.stateAddress], [36, data.length],
    [40, binding.stateAddress + data.length], [44, image.bssBytes], [48, 256 + code.length], [52, bytes.length]]) view.setUint32(offset, value, true);
  bytes.set(code, 256); bytes.set(data, 256 + code.length);
  bytes.set(digestBytes(await sha256(bytes.subarray(256))), 64);
  bytes.set(digestBytes(await sha256(bytes.subarray(0, 96))), 96);
  await validateStatefulCapsule(bytes, binding, signal);
  return bytes;
}
