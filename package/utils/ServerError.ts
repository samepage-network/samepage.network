class ServerError extends Error {
  readonly code;
  constructor(arg: string, code: number) {
    super(arg);
    this.code = code;
  }
}

export default ServerError;
