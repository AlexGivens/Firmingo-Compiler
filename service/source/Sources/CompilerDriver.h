#ifndef ARDUINO_COMPILER_DRIVER_H
#define ARDUINO_COMPILER_DRIVER_H

#include <string>
#include <vector>

namespace arduino::compiler_service {

/// Runs Clang's GCC-compatible driver and integrated frontend in this process.
int runClang(const std::vector<std::string> &arguments,
             std::string &diagnostics);

} // namespace arduino::compiler_service

#endif
