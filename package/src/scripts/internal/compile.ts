import nearleyCompile from "./nearley";
import esbuild from "esbuild";
import fs from "fs";
import path from "path";

export type CliArgs = {
  out?: string;
  external?: string | string[];
  include?: string | string[];
  css?: string;
};

const compile = ({
  out,
  nodeEnv,
  external,
  include,
  css,
}: CliArgs & { nodeEnv: "production" | "development" | "test" }) => {
  const rootDir = fs
    .readdirSync("./src", { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name);
  const rootTs = rootDir.filter((f) => /\.ts$/.test(f));
  const rootCss = rootDir.filter((f) => /\.css$/.test(f));
  const entryTs =
    rootTs.length === 1
      ? `./src/${rootTs[0]}`
      : `./src/${["index.ts", "main.ts"].find((f) => rootTs.includes(f))}`;
  const entryCss =
    rootCss.length === 1
      ? `./src/${rootCss[0]}`
      : `./src/${["index.css", "main.css"].find((f) => rootCss.includes(f))}`;
  if (!entryTs) {
    return Promise.reject(
      `Could not find a suitable entry file in ./src directory. Found: [${rootTs.join(
        ", "
      )}]`
    );
  }
  return esbuild
    .build({
      entryPoints: out
        ? { [out]: entryTs, ...(entryCss ? { [out]: entryCss } : {}) }
        : [entryTs, ...(entryCss ? [entryCss] : [])],
      outdir: "dist",
      bundle: true,
      incremental: nodeEnv === "development",
      define: {
        "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
        "process.env.NODE_ENV": `"${nodeEnv}"`,
      },
      format: "cjs",
      external: typeof external === "string" ? [external] : external,
      plugins: [
        {
          name: "nearley",
          setup(build) {
            build.onResolve({ filter: /\.ne$/ }, (args) => ({
              path: path.resolve(args.resolveDir, args.path),
              namespace: "nearley-ne",
            }));
            build.onLoad({ filter: /.*/, namespace: "nearley-ns" }, (args) =>
              nearleyCompile(args.path).then((contents) => ({
                contents,
                loader: "ts",
                resolveDir: path.dirname(args.path),
              }))
            );
          },
        },
      ],
    })
    .then((r) => {
      const finish = () => {
        (typeof include === "string" ? [include] : include || []).forEach(
          (f) => {
            fs.cpSync(f, path.join("dist", path.basename(f)));
          }
        );
        if (css) {
          const outCssFilename = path.join(
            "dist",
            `${css.replace(/.css$/, "")}.css`
          );
          const inputCssFiles = fs
            .readdirSync("dist")
            .filter((f) => /.css$/.test(f));

          if (inputCssFiles.length === 0) {
            console.warn("No css files in the dist/ directory");
          } else if (inputCssFiles.length === 1) {
            fs.renameSync(path.join("dist", inputCssFiles[0]), outCssFilename);
          } else {
            fs.writeFileSync(outCssFilename, "");
            inputCssFiles.forEach((f) => {
              const cssFileContent = fs
                .readFileSync(path.join("dist", f))
                .toString();
              fs.rmSync(path.join("dist", f));
              fs.appendFileSync(outCssFilename, cssFileContent);
              fs.appendFileSync(outCssFilename, "\n");
            });
          }
        }
      };
      finish();
      const { rebuild: rebuilder } = r;
      return rebuilder
        ? {
            ...r,
            rebuild: (): Promise<void> => rebuilder().then(finish),
          }
        : r;
    });
};

export default compile;
