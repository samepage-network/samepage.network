import debugMod from "debug";

// Madge circular dependency false positives on this having the same name as the module
const debug = (s: string) => {
  const d = debugMod(s);
  d.log = console.log.bind(console);
  return d;
};

export default debug;
