#ifndef ARDUINO_LINKER_DRIVER_H
#define ARDUINO_LINKER_DRIVER_H

#include <string>
#include <vector>

namespace arduino::compiler_service {

/// Runs LLD's ELF driver in this process and captures both output streams.
int runLLD(const std::vector<std::string> &arguments,
           std::string &diagnostics, bool &canRunAgain);

} // namespace arduino::compiler_service

#endif
