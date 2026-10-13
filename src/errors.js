/** Stable input error; the path identifies the rejected field without echoing user source. */
export class ContractError extends Error {
  constructor(code, path, message) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.path = path;
  }
}
