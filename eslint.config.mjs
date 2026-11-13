import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

/**
 * Two layers. Correctness: ESLint's recommended set (an undefined name, an
 * unused variable, unreachable code), which is what keeps a slip from
 * shipping. Style: the Google JS Style Guide's enforceable subset (jsguide
 * sections 4–6): 2-space indent, single quotes, required semicolons, brace
 * style, camelCase with CONSTANT_CASE for module constants, const/let only,
 * === with the `== null` idiom allowed, an 80-column limit.
 */
const rules = {
  ...js.configs.recommended.rules,
  // A type the style guide declares as `/** @typedef {...} */ let Name;` is
  // named in JSDoc only, so an unused PascalCase variable is not flagged;
  // nor is a property named in a rest pattern in order to leave it out.
  "no-unused-vars": ["error", {
    args: "after-used",
    caughtErrors: "none",
    ignoreRestSiblings: true,
    varsIgnorePattern: "^[A-Z][A-Za-z0-9]*$",
  }],
  // A catch that deliberately swallows says so in a comment.
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-duplicate-imports": "error",
  "@stylistic/indent": ["error", 2],
  "@stylistic/quotes": ["error", "single", { avoidEscape: true, allowTemplateLiterals: "always" }],
  "@stylistic/semi": ["error", "always"],
  "@stylistic/brace-style": ["error", "1tbs"],
  "@stylistic/comma-dangle": ["error", "always-multiline"],
  // 80 columns per jsguide 4.4, with its listed exceptions: module
  // import/export statements, URLs, and string/template literals that
  // cannot reasonably be split (the view HTML templates).
  "@stylistic/max-len": ["error", {
    code: 80,
    ignoreUrls: true,
    ignorePattern: "^\\s*(import[\\s\\{]|export\\s.*from|\\} from)",
    ignoreTemplateLiterals: true,
    ignoreStrings: true,
    ignoreRegExpLiterals: true,
  }],
  "no-var": "error",
  "prefer-const": "error",
  camelcase: ["error", { properties: "never" }],
  eqeqeq: ["error", "always", { null: "ignore" }],
};

const base = {
  plugins: { "@stylistic": stylistic },
  rules,
};

export default [
  { ignores: ["src/generated/**"] },
  {
    ...base,
    // The site: the page and its search worker.
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.worker,
        __BUILD_ID__: "readonly",
      },
    },
  },
  {
    ...base,
    // Node, plus the page's names: the scrapers and the browser specs pass
    // functions into a page, and the test harness stands in for one.
    files: ["scripts/**/*.mjs", "test/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
