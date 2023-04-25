const {
  createRoutesFromFolders,
} = require("@remix-run/v1-route-convention");

/**
 * @type {import('@remix-run/dev/config').AppConfig}
 */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  devServerPort: 8002,
  ignoredRouteFiles: [".*", "_*"],
  publicPath: "/build/",
  serverBuildPath: "app/server/build/index.js",
  future: {
    v2_normalizeFormMethod: true,
    v2_errorBoundary: true,
    v2_meta: true,
    v2_routeConvention: true,
  },
  routes(defineRoutes) {
    // uses the v1 convention, works in v1.15+ and v2
    return createRoutesFromFolders(defineRoutes);
  },
};
