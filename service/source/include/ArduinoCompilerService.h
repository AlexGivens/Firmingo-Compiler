#ifndef ARDUINO_COMPILER_SERVICE_H
#define ARDUINO_COMPILER_SERVICE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// The stable filesystem-oriented ABI exposed to native hosts and WebAssembly.
///
/// Version 2 accepts newline-delimited Clang-driver and LLD argument files. A
/// WASI host will mount immutable toolchain assets and a per-build workspace,
/// then invoke the separate compile and link phases without subprocesses.
#define ARDUINO_COMPILER_SERVICE_ABI_VERSION 2u

/// Returns the version of the exported compiler-service ABI.
uint32_t arduino_compiler_service_abi_version(void);

/// Compiles one translation unit and links its firmware in the current process.
///
/// - Parameters:
///   - clang_response_path: A UTF-8 path containing one Clang driver argument
///     per line. The first argument must be the synthetic executable name.
///   - lld_response_path: A UTF-8 path containing one ELF LLD argument per
///     line. The first argument must be the synthetic linker name.
/// - Returns: Zero on success and a process-style nonzero status on failure.
int32_t arduino_compiler_service_build(const char *clang_response_path,
                                       const char *lld_response_path);

/// Compiles one translation unit from a newline-delimited Clang argument file.
///
/// This begins a new service build, clears prior diagnostics, and leaves the
/// generated object at the output path supplied in the response file.
///
/// - Parameter clang_response_path: A UTF-8 path containing one Clang driver
///   argument per line, beginning with the synthetic executable name.
/// - Returns: Zero on success and a process-style nonzero status on failure.
int32_t arduino_compiler_service_compile(const char *clang_response_path);

/// Links one firmware image from a newline-delimited LLD argument file.
///
/// Diagnostics are appended to the active build. The host must inspect
/// `arduino_compiler_service_can_run_again` after every link attempt.
///
/// - Parameter lld_response_path: A UTF-8 path containing one ELF LLD argument
///   per line, beginning with the synthetic linker name.
/// - Returns: Zero on success and a process-style nonzero status on failure.
int32_t arduino_compiler_service_link(const char *lld_response_path);

/// Returns a pointer to the most recent UTF-8 diagnostic buffer.
///
/// The pointer remains valid until the next service invocation. Use
/// `arduino_compiler_service_last_diagnostics_size` instead of assuming that
/// the buffer is null terminated when importing it from WebAssembly memory.
const char *arduino_compiler_service_last_diagnostics(void);

/// Returns the byte count of the most recent UTF-8 diagnostic buffer.
size_t arduino_compiler_service_last_diagnostics_size(void);

/// Reports whether the same service instance is safe to use for another build.
///
/// LLD can detect failures after which its process state may be corrupted. A
/// WebAssembly host must discard and instantiate a fresh module when this
/// function returns zero.
int32_t arduino_compiler_service_can_run_again(void);

#ifdef __cplusplus
}
#endif

#endif
