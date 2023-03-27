class UserOnlyError extends Error {
  skipEmail: boolean = true;
  constructor(message: string) {
    super(message);
  }
}

export default UserOnlyError;
