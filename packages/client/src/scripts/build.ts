import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import appPath from "./internal/appPath";
import nearleyCompile from "./internal/nearley";
import readDir from "./internal/readDir";

const cssFiles = [
  "node_modules/normalize.css/normalize.css",
  "node_modules/@blueprintjs/icons/lib/css/blueprint-icons.css",
  "node_modules/@blueprintjs/core/lib/css/blueprint.css",
];

const grammarFiles = readDir(appPath(".")).filter((t) => /\.ne$/.test(t));

const build = ({ out }: { out?: string } = {}) =>
  Promise.all(grammarFiles.map(nearleyCompile))
    .then(() =>
      esbuild.build({
        entryPoints: out ? { [out]: "./src/index.tsx" } : ["./src/index.tsx"],
        outdir: "dist",
        bundle: true,
        define: {
          "process.env.BLUEPRINT_NAMESPACE": '"bp4"',
          "process.env.NODE_ENV": '"production"',
        },
      })
    )
    .then(() => {
      cssFiles.forEach((f) =>
        fs.cpSync(f, path.join("dist", path.basename(f)))
      );
      console.log("done");
      return 0;
    });

export default build;
