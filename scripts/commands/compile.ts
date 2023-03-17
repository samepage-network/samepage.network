import nodeCompile from "../../package/scripts/internal/nodeCompile";
import readDir from "../../package/scripts/internal/readDir";

const root = "api";
const ignoreRegexes = ["_common", "car", "clerk", "extensions"].map(
  (path) => new RegExp(`^${root}[/\\\\]${path}`)
);

const compile = ({
  readable = false,
}: {
  readable?: boolean;
}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "production";
  return nodeCompile({
    functions: readDir(root)
      .filter((f) => !ignoreRegexes.some((r) => r.test(f)))
      .map((f) =>
        f.replace(/\.[t|j]s$/, "").replace(new RegExp(`^${root}[/\\\\]`), "")
      ),
    opts: { minify: !readable },
  }).then((r) => {
    if (r.errors.length) {
      throw new Error(JSON.stringify(r.errors));
    } else {
      return r.errors.length;
    }
  });
};

export default compile;
