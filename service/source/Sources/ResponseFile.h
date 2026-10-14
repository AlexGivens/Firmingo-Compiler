#ifndef ARDUINO_RESPONSE_FILE_H
#define ARDUINO_RESPONSE_FILE_H

#include <string>
#include <vector>

namespace arduino::compiler_service {

/// Reads a UTF-8, newline-delimited argument file without shell expansion.
bool readResponseFile(const char *path, std::vector<std::string> &arguments,
                      std::string &diagnostics);

} // namespace arduino::compiler_service

#endif
