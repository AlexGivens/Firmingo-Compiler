#include "ArduinoCompilerService.h"

#include "CompilerDriver.h"
#include "LinkerDriver.h"
#include "ResponseFile.h"

#include <string>
#include <vector>

namespace {

/// Stores diagnostics for the single-threaded native/WASI service instance.
std::string lastDiagnostics;

/// Records whether LLD considers another invocation safe in this instance.
bool lastCanRunAgain = true;

/// Compiles an already decoded Clang invocation and appends its diagnostics.
int32_t compileArguments(const std::vector<std::string> &arguments) {
  std::string phaseDiagnostics;
  const int result =
      arduino::compiler_service::runClang(arguments, phaseDiagnostics);
  lastDiagnostics += phaseDiagnostics;
  return result;
}

/// Links an already decoded LLD invocation and appends its diagnostics.
int32_t linkArguments(const std::vector<std::string> &arguments) {
  std::string phaseDiagnostics;
  const int result = arduino::compiler_service::runLLD(
      arguments, phaseDiagnostics, lastCanRunAgain);
  lastDiagnostics += phaseDiagnostics;
  return result;
}

} // namespace

uint32_t arduino_compiler_service_abi_version(void) {
  return ARDUINO_COMPILER_SERVICE_ABI_VERSION;
}

int32_t arduino_compiler_service_build(const char *clang_response_path,
                                       const char *lld_response_path) {
  std::vector<std::string> clangArguments;
  std::vector<std::string> lldArguments;
  lastDiagnostics.clear();
  lastCanRunAgain = true;
  if (!arduino::compiler_service::readResponseFile(
          clang_response_path, clangArguments, lastDiagnostics)) {
    return 2;
  }
  if (!arduino::compiler_service::readResponseFile(
          lld_response_path, lldArguments, lastDiagnostics)) {
    return 2;
  }

  const int compileResult = compileArguments(clangArguments);
  if (compileResult != 0) {
    return compileResult;
  }
  return linkArguments(lldArguments);
}

int32_t arduino_compiler_service_compile(const char *clang_response_path) {
  std::vector<std::string> arguments;
  lastDiagnostics.clear();
  lastCanRunAgain = true;
  if (!arduino::compiler_service::readResponseFile(
          clang_response_path, arguments, lastDiagnostics)) {
    return 2;
  }
  return compileArguments(arguments);
}

int32_t arduino_compiler_service_link(const char *lld_response_path) {
  std::vector<std::string> arguments;
  if (!arduino::compiler_service::readResponseFile(
          lld_response_path, arguments, lastDiagnostics)) {
    return 2;
  }
  return linkArguments(arguments);
}

const char *arduino_compiler_service_last_diagnostics(void) {
  return lastDiagnostics.data();
}

size_t arduino_compiler_service_last_diagnostics_size(void) {
  return lastDiagnostics.size();
}

int32_t arduino_compiler_service_can_run_again(void) {
  return lastCanRunAgain ? 1 : 0;
}
