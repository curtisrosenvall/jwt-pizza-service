import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,     // Add Node.js globals
        ...globals.browser,
        ...globals.jest      // Add Jest globals for testing
      }
    }
  },
  pluginJs.configs.recommended,
  {
    rules: {
      'no-console': 'off',     // Allow console.log
      'no-undef': 'error',     // Keep undefined variables as errors
      'no-unused-vars': ['warn', { 
        'argsIgnorePattern': '^_',  // Variables starting with underscore are ignored
        'varsIgnorePattern': '^_'   // Same for function args
      }]
    }
  }
];