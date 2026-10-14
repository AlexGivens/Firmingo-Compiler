#if defined(__wasi__)

/// Accepts thread-local destructor registration in the single-threaded reactor.
///
/// WASI libc++abi omits this hook when threading is disabled. Compiler-service
/// instances are isolated workers whose complete linear memory is reclaimed on
/// disposal, so retaining these objects for the instance lifetime is correct.
extern "C" int __cxa_thread_atexit(
    void (*destructor)(void *), void *object, void *dynamicSharedObject) {
  (void)destructor;
  (void)object;
  (void)dynamicSharedObject;
  return 0;
}

#endif
