module.exports = {
  content: [
    "./app/**/*.tsx",
    "./node_modules/@dvargas92495/app/**/*.js",
    "./packages/client/src/components/**/*.tsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/forms")],
};
