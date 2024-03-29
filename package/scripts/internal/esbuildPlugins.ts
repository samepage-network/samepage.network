import esbuild from "esbuild";

const esbuildPlugins = (source: string): esbuild.Plugin[] => [
  {
    name: "log",
    setup: (build) => {
      build.onEnd((result) => {
        console.log(`${source} built with ${result.errors.length} errors`);
      });
    },
  },
];

export default esbuildPlugins;
