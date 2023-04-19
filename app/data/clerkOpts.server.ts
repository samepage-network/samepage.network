const clerkOpts = {
  // clerk uses a `getEnvVariable` method to load env vars, which breaks in esbuild define.
  // We need to manually pass them in
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
};

export default clerkOpts;
