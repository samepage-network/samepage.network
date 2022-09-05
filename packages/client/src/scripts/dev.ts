import esbuild from "esbuild";
import chokidar from "chokidar";
import nearleyCompile from "./internal/nearley";

const dev = ({ out }: { out?: string } = {}) => {
  let rebuilder: esbuild.BuildInvalidate;
  return new Promise((resolve) => {
    chokidar
      .watch(["src"])
      .on("add", (file) => {
        if (file === "src/index.tsx") {
          console.log(`building ${file}...`);
          esbuild
            .build({
              entryPoints: out
                ? { [out]: "./src/index.tsx" }
                : ["./src/index.tsx"],
              outdir: "dist",
              bundle: true,
              define: {
                "process.env.API_URL": '"http://localhost:3003"',
                "process.env.NODE_ENV": '"development"',
                "process.env.WEB_SOCKET_URL": '"ws://127.0.0.1:3010"',
              },
              incremental: true,
            })
            .then((r) => {
              rebuilder = r.rebuild;
              console.log(`successfully built ${file}...`);
            });
        } else if (/\.ne$/.test(file)) {
          nearleyCompile(file).then(() => {
            console.log(`successfully compiled ${file}...`);
          });
        }
      })
      .on("change", (file) => {
        console.log(`File ${file} has been changed`);
        if (/\.tsx?$/.test(file) && rebuilder) {
          rebuilder()
            .then(() => console.log(`Rebuilt index.tsx`))
            .catch((e) => console.error(`Failed to rebuild`, file, e));
        } else if (/\.ne$/.test(file)) {
          nearleyCompile(file).then(() => {
            console.log(`successfully compiled ${file}...`);
          });
        }
      });
    process.on("exit", resolve);
  }).then(() => 0);
};

export default dev;
