const catchError =
  (subject: string, message?: string) =>
  (e: Error): Promise<never> => {
    e.message = `${e.name}: ${e.message}${message ? `\n\n${message}\n` : ""}`;
    e.name = subject;
    return Promise.reject(e);
  };

export default catchError;
