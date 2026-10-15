/** Trusted maintenance pins; the service must be provisioned explicitly, never downloaded here. */
export const SERVICE = Object.freeze({ bytes: 101194565,
  sha256: "a7648688ae9e349304c576804367b66b68b22185060a847a2e292675329ca493",
  serviceABI: 2, compiler: "Clang/LLD 22.1.8 ABI-two WASI service", maximumMemoryBytes: 268435456 });
export const SHIM = Object.freeze({ package: "@bjorn3/browser_wasi_shim", version: "0.4.2",
  receiptSHA256: "1ad1971d3617837d1bc858a31c488d112b20ec6f8df9eecfccb361af2303087d" });
export const RECIPE_ASSETS = Object.freeze([{"path":"Recipe/Arduino.h","bytes":5022,"sha256":"46e2ecc7ac653b12c6f63ab616e4a49c347c6ece360e203011337733987d60da"},{"path":"Recipe/Entry.cpp","bytes":572,"sha256":"80e5f48e6512d61f247d61e6637c40abeb25a2b9c84093e81390ee8aeed6d88d"},{"path":"Recipe/Module.ld","bytes":1078,"sha256":"a8ded6a674337881bd650ed38b39cdba1299cd469f5e238317989e1e96de0da8"},{"path":"Sources/ManagedRecipe.js","bytes":3496,"sha256":"e30c8f523d7938cb92127f4bb430ebb88d59f7b32dd3c430665409477e4a058e"}].map(item => Object.freeze(item)));

/** Exact ABI-two recipe resources, selected only for nano-managed-v2. */
export const STATEFUL_RECIPE_ASSETS = Object.freeze([{"path":"Recipe/Arduino.h","bytes":5396,"sha256":"95123ec4bb7bc5ba023e84fb420f84d8805da3927d4f8be7857f082a21d0e039"},{"path":"Recipe/Entry.cpp","bytes":572,"sha256":"80e5f48e6512d61f247d61e6637c40abeb25a2b9c84093e81390ee8aeed6d88d"},{"path":"Recipe/Module.ld","bytes":1333,"sha256":"1d4cf45f05a0eed3242f475e6e11facae8c131182e980e73fd5551532c64829c"},{"path":"Sources/ManagedRecipe.js","bytes":4011,"sha256":"5984a4c859d2104841aaab2e199362c8049d13148a8b8ae351beb25daf1f9e0d"}].map(item => Object.freeze(item)));
