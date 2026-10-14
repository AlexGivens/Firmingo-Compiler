#include "ResponseFile.h"

#include <fstream>
#include <string>

namespace arduino::compiler_service {

bool readResponseFile(const char *path, std::vector<std::string> &arguments,
                      std::string &diagnostics) {
  if (path == nullptr || path[0] == '\0') {
    diagnostics = "error: response-file path is missing\n";
    return false;
  }

  std::ifstream stream(path, std::ios::binary);
  if (!stream.is_open()) {
    diagnostics = std::string("error: could not open response file: ") + path +
                  "\n";
    return false;
  }

  arguments.clear();
  std::string line;
  while (std::getline(stream, line)) {
    if (!line.empty() && line.back() == '\r') {
      line.pop_back();
    }
    if (line.find('\0') != std::string::npos) {
      diagnostics = std::string("error: response file contains a null byte: ") +
                    path + "\n";
      return false;
    }
    if (!line.empty()) {
      arguments.push_back(std::move(line));
    }
  }

  if (!stream.eof()) {
    diagnostics = std::string("error: failed while reading response file: ") +
                  path + "\n";
    return false;
  }
  if (arguments.empty()) {
    diagnostics = std::string("error: response file contains no arguments: ") +
                  path + "\n";
    return false;
  }
  return true;
}

} // namespace arduino::compiler_service
