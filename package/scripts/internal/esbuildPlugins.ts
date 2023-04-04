import esbuild from "esbuild";

const esbuildPlugins: esbuild.Plugin[] = [
  {
    name: "log",
    setup: (build) => {
      build.onEnd((result) => {
        console.log(`build completed with ${result.errors.length} errors`);
      });
    },
  },
];

export default esbuildPlugins;
