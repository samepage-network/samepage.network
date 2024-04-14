const plugin = require("tailwindcss/plugin");

module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./package/components/**/*.tsx",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        primary: "#000044",
        accent: "#5da6ed",
        secondary: "#EBF4FB",
        tertiary: "#F7FAFD",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
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
