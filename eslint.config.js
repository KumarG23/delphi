// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "docs/**/*"],
  },
  {
    files: ["components/__tests__/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        it: "readonly",
        expect: "readonly",
      },
    },
  }
]);
