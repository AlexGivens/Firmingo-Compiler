#include "LinkerDriver.h"

#include "lld/Common/Driver.h"
#include "llvm/ADT/SmallVector.h"
#include "llvm/Support/raw_ostream.h"

LLD_HAS_DRIVER(elf)

namespace arduino::compiler_service {

int runLLD(const std::vector<std::string> &arguments,
           std::string &diagnostics, bool &canRunAgain) {
  if (arguments.empty()) {
    diagnostics = "error: the LLD response file is empty\n";
    canRunAgain = true;
    return 2;
  }

  llvm::SmallVector<const char *, 128> rawArguments;
  rawArguments.reserve(arguments.size());
  for (const std::string &argument : arguments) {
    rawArguments.push_back(argument.c_str());
  }

  std::string standardOutput;
  std::string standardError;
  llvm::raw_string_ostream outputStream(standardOutput);
  llvm::raw_string_ostream errorStream(standardError);
  const lld::DriverDef drivers[] = {{lld::Gnu, &lld::elf::link}};
  const lld::Result result =
      lld::lldMain(rawArguments, outputStream, errorStream, drivers);
  outputStream.flush();
  errorStream.flush();
  diagnostics = standardOutput + standardError;
  canRunAgain = result.canRunAgain;
  if (!result.canRunAgain) {
    diagnostics += "error: LLD disabled safe compiler-service re-entry; "
                   "instantiate a fresh module before the next build\n";
    return result.retCode == 0 ? 70 : result.retCode;
  }
  return result.retCode;
}

} // namespace arduino::compiler_service
