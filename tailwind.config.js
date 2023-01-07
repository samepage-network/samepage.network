const plugin = require("tailwindcss/plugin");

module.exports = {
  content: [
    "./app/**/*.tsx",
    "./node_modules/@dvargas92495/app/**/*.js",
    "./package/components/**/*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#000044",
        accent: "#5da6ed",
        secondary: "#EBF4FB",
        tertiary: "#F7FAFD",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    plugin(({ addBase }) => {
      addBase({
        "@font-face": [
          {
            "font-family": "Syne",
            src: "url(/fonts/Syne-VariableFont_wght.ttf) format('truetype')",
          },
          {
            "font-family": "Familjen Grotesk",
            src: "url(/fonts/FamiljenGrotesk-VariableFont_wght.ttf) format('truetype')",
          },
        ],
      });
    }),
  ],
};
