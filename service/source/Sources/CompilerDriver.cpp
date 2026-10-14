#include "CompilerDriver.h"

#include "clang/Basic/Diagnostic.h"
#include "clang/Basic/DiagnosticOptions.h"
#include "clang/Driver/Compilation.h"
#include "clang/Driver/Driver.h"
#include "clang/Frontend/CompilerInstance.h"
#include "clang/Frontend/CompilerInvocation.h"
#include "clang/Frontend/TextDiagnosticPrinter.h"
#include "clang/FrontendTool/Utils.h"
#include "llvm/ADT/ArrayRef.h"
#include "llvm/ADT/SmallVector.h"
#include "llvm/Support/TargetSelect.h"
#include "llvm/Support/VirtualFileSystem.h"
#include "llvm/Support/raw_ostream.h"
#include "llvm/TargetParser/Host.h"

#include <memory>
#include <utility>

namespace arduino::compiler_service {
namespace {

/// Executes the `-cc1` job emitted by Clang's driver without a subprocess.
int runIntegratedFrontend(llvm::SmallVectorImpl<const char *> &arguments,
                          llvm::raw_ostream &diagnosticStream) {
  if (arguments.size() < 2 || llvm::StringRef(arguments[1]) != "-cc1") {
    diagnosticStream << "error: compiler service received an unsupported "
                        "integrated Clang tool\n";
    return 1;
  }

  auto diagnosticOptions = std::make_shared<clang::DiagnosticOptions>();
  auto diagnosticPrinter = std::make_unique<clang::TextDiagnosticPrinter>(
      diagnosticStream, *diagnosticOptions);
  clang::DiagnosticsEngine invocationDiagnostics(
      clang::DiagnosticIDs::create(), *diagnosticOptions,
      diagnosticPrinter.get(), false);

  auto invocation = std::make_shared<clang::CompilerInvocation>();
  const llvm::ArrayRef<const char *> frontendArguments(arguments);
  const bool parsed = clang::CompilerInvocation::CreateFromArgs(
      *invocation, frontendArguments.drop_front(2), invocationDiagnostics,
      arguments[0]);
  if (!parsed) {
    return 1;
  }

  clang::CompilerInstance compiler(std::move(invocation));
  compiler.createDiagnostics(diagnosticPrinter.get(), false);
  if (!compiler.hasDiagnostics()) {
    diagnosticStream << "error: Clang could not create its diagnostics engine\n";
    return 1;
  }

  return clang::ExecuteCompilerInvocation(&compiler) ? 0 : 1;
}

} // namespace

int runClang(const std::vector<std::string> &arguments,
             std::string &diagnostics) {
  if (arguments.empty()) {
    diagnostics = "error: the Clang response file is empty\n";
    return 2;
  }

  static const bool targetsInitialized = [] {
    llvm::InitializeAllTargets();
    llvm::InitializeAllTargetMCs();
    llvm::InitializeAllAsmParsers();
    llvm::InitializeAllAsmPrinters();
    return true;
  }();
  static_cast<void>(targetsInitialized);

  llvm::SmallVector<const char *, 128> rawArguments;
  rawArguments.reserve(arguments.size());
  for (const std::string &argument : arguments) {
    rawArguments.push_back(argument.c_str());
  }

  std::string capturedDiagnostics;
  llvm::raw_string_ostream diagnosticStream(capturedDiagnostics);
  auto diagnosticOptions = std::make_shared<clang::DiagnosticOptions>();
  auto diagnosticPrinter = std::make_unique<clang::TextDiagnosticPrinter>(
      diagnosticStream, *diagnosticOptions);
  clang::DiagnosticsEngine driverDiagnostics(
      clang::DiagnosticIDs::create(), *diagnosticOptions,
      diagnosticPrinter.get(), false);

  const auto filesystem = llvm::vfs::getRealFileSystem();
  clang::driver::Driver driver(arguments.front(),
                               llvm::sys::getDefaultTargetTriple(),
                               driverDiagnostics,
                               "Arduino direct compiler service", filesystem);
  auto runFrontend = [&diagnosticStream](
                         llvm::SmallVectorImpl<const char *> &frontendArguments) {
    return runIntegratedFrontend(frontendArguments, diagnosticStream);
  };
  driver.CC1Main = runFrontend;

  std::unique_ptr<clang::driver::Compilation> compilation(
      driver.BuildCompilation(rawArguments));
  if (!compilation || compilation->containsError()) {
    diagnosticStream.flush();
    diagnostics = std::move(capturedDiagnostics);
    return 1;
  }

  llvm::SmallVector<std::pair<int, const clang::driver::Command *>, 4>
      failingCommands;
  const int result = driver.ExecuteCompilation(*compilation, failingCommands);
  driverDiagnostics.getClient()->finish();
  diagnosticStream.flush();
  diagnostics = std::move(capturedDiagnostics);
  return result;
}

} // namespace arduino::compiler_service
