import Splat, { loader as splatLoader, links, meta } from "./$";
import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = (args) =>
  splatLoader({ ...args, params: { "*": "index" } });

export { links, meta };

export default Splat;
