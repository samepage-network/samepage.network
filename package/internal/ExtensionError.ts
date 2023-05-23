import { JSONData } from "./types";

class ExtensionError extends Error {
  data: JSONData;
  constructor(message: string, data: JSONData) {
    super(message);
    this.data = data;
  }
}

export default ExtensionError;
