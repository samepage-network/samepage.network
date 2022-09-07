import appPath from "./appPath";
import nearleyCompile from "./nearley";
import readDir from "./readDir";
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
}: CliArgs & { nodeEnv: "production" | "development" | "test" }) =>
  Promise.all(
    readDir(appPath("./src"))
      .filter((t) => /\.ne$/.test(t))
      .map(nearleyCompile)
  )
    .then(() => {
      const root = fs
        .readdirSync("./src", { withFileTypes: true })
        .filter((f) => f.isFile() && /\.ts/.test(f.name))
        .map((f) => f.name);
      const entry =
        root.length === 1
          ? `./src/${root[0]}`
          : `./src/${["index.ts", "main.ts"].find((f) => root.includes(f))}`;
      if (!entry) {
        return Promise.reject(
          `Could not find a suitable entry file in ./src directory. Found: [${root.join(
            ", "
          )}]`
        );
      }
      return esbuild.build({
        entryPoints: out ? { [out]: entry } : [entry],
        outdir: "dist",
        bundle: true,
        incremental: nodeEnv === "development",
        define: {
          "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
          "process.env.NODE_ENV": `"${nodeEnv}"`,
        },
        format: "cjs",
        external: typeof external === "string" ? [external] : external,
      });
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

export default compile;
