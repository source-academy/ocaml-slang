import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import nodePolyfills from "rollup-plugin-polyfill-node";

// One evaluator, as one file that the frontend starts in a worker from a blob: URL.
// The OCaml toplevel (dist/ocaml-toplevel.js) is a separate file, fetched when the evaluator starts.
/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/conductor/initialise.ts",
  output: {
    file: "dist/OCamlEvaluator.js",
    format: "iife",
    name: "OCamlSlangWorker",
    sourcemap: true,
  },
  treeshake: { moduleSideEffects: false },
  plugins: [
    commonjs({ include: ["node_modules/**"] }),
    json(),
    typescript({ tsconfig: "./tsconfig.json", outDir: undefined, declaration: false }),
    nodeResolve(),
    nodePolyfills(),
    terser({ compress: { dead_code: true, passes: 3 } }),
  ],
};
