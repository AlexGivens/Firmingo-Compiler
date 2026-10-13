/** Reviewed input limits for the initial single-file, stateless Nano contract. */
export const LIMITS = Object.freeze({
  jsonBytes: 2 * 1024 * 1024,
  jsonDepth: 8,
  jsonTokens: 4096,
  sourceBytes: 256 * 1024,
  filenameBytes: 96,
  identifierBytes: 128,
  deadlineMilliseconds: 60000,
});

/** Pinned selection, not a recipe implementation or declaration of hardware support. */
export const NANO_BASELINE = Object.freeze({
  board: "nano_rp2040_connect",
  profile: "nano-managed-v1",
  recipeIdentifier: "nano-stateless-clang-22.1.8-v1-experimental",
  recipeSHA256: "b7869f6fc863e1905deb6974408c6e7dc63943a1fb3e342a357fdf757b1e23d9",
  residentABI: 1,
  targetID: 1,
  maximumCapsuleBytes: 4096,
});
