#include "ArduinoCompilerService.h"

#include <iostream>
#include <string_view>

/// Runs the native validation CLI for the future WebAssembly service ABI.
int main(int argumentCount, char **argumentValues) {
  if (argumentCount == 2 &&
      std::string_view(argumentValues[1]) == "--version") {
    std::cout << "arduino-compiler-service ABI "
              << arduino_compiler_service_abi_version() << '\n';
    return 0;
  }
  if (argumentCount != 4 ||
      std::string_view(argumentValues[1]) != "build") {
    std::cerr << "usage: arduino-compiler-service build "
                 "<clang-arguments.txt> <lld-arguments.txt>\n";
    return 64;
  }

  const int result = arduino_compiler_service_build(argumentValues[2],
                                                     argumentValues[3]);
  std::cerr.write(arduino_compiler_service_last_diagnostics(),
                  static_cast<std::streamsize>(
                      arduino_compiler_service_last_diagnostics_size()));
  return result;
}
