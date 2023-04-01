import debugMod from "debug";

const debug = (s: string) => {
  const d = debugMod(s);
  d.log = console.log.bind(console);
  return d;
};

export default debug;
