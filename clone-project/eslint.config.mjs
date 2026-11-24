import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import quality from "./eslint-rules/index.cjs";

const testFiles = [
  "**/*{.,-}{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
  "**/{__tests__,__mocks__,fixtures,mocks,test}/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}",
];

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    plugins: { quality },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // File-size ceiling (Vibe Coding Toolkit Quality Gates - Max 350 lines)
      "quality/max-lines": ["error", { max: 350 }],
      "quality/no-direct-console": [
        "warn",
        { logger: "NestJS Logger (new Logger())" },
      ],
    },
  },
  {
    // Frontend browser scripts
    files: ["public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        Float32Array: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        io: "readonly",
        alert: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        Audio: "readonly",
        URLSearchParams: "readonly",
        RTCPeerConnection: "readonly",
        RTCSessionDescription: "readonly",
        RTCIceCandidate: "readonly",
        MediaStream: "readonly",
        FileReader: "readonly",
        console: "readonly",
        fetch: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Event: "readonly",
        THREE: "readonly",
        gsap: "readonly",
        performance: "readonly",
      },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Logger implementations or bootstrap files are allowed to use direct console if needed
    files: ["src/main.ts", "src/shared/logger/**/*.ts", "src/infrastructure/database/seed.ts"],
    rules: {
      "quality/no-direct-console": "off",
    },
  },
  {
    // Test files allowance
    files: testFiles,
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { max: 350, includeTests: true }],
      "@typescript-eslint/no-explicit-any": "off",
      "quality/no-direct-console": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs", "desktop/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly", process: "readonly", Buffer: "readonly", __dirname: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "target/**",
    "desktop/target/**",
    "public/js/vendor/**",
    "**/*.WebView2/**",
    "**/*.tsbuildinfo",
    "package-lock.json",
  ]),
]);
