import type { Toplevel } from "./toplevel";

/** Where the toplevel bundle is published: next to the evaluator, on GitHub Pages. */
export const TOPLEVEL_URL = "https://source-academy.github.io/ocaml-slang/ocaml-toplevel.js";

/**
 * Where to fetch the toplevel from, if not {@link TOPLEVEL_URL}: set `OCAML_SLANG_TOPLEVEL_URL` on
 * the global object before the evaluator starts. Under Node (the tests, the grader's host) it can
 * also be the path of a file, which needs no network, and it can be set in the environment
 * (`process.env`), which a host passes to a worker thread without a wrapper script.
 */
function configuredUrl(): string {
  const url = (globalThis as { OCAML_SLANG_TOPLEVEL_URL?: unknown }).OCAML_SLANG_TOPLEVEL_URL;
  if (typeof url === "string" && url !== "") return url;
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.OCAML_SLANG_TOPLEVEL_URL;
  return fromEnv ? fromEnv : TOPLEVEL_URL;
}

type NodeRequire = (id: string) => unknown;
type NodeFs = { promises: { readFile(path: string, encoding: "utf8"): Promise<string> } };

/** Node's `require`, which the evaluator's script does not have as a global: the loader's own, to read the toplevel from a file. The toplevel is not given it (see {@link runInNode}). */
function nodeRequire(): NodeRequire | undefined {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  if (proc?.getBuiltinModule)
    return (id: string) => proc.getBuiltinModule!(id.replace(/^(?!node:)/, "node:"));
  // Node before 22.3, where the evaluator is a CommonJS script
  return typeof require === "function" ? (require as NodeRequire) : undefined;
}

function nodeFs(): NodeFs | undefined {
  return nodeRequire()?.("fs") as NodeFs | undefined;
}

export async function fetchScript(source: string): Promise<string> {
  if (!/^https?:\/\//.test(source)) {
    const fs = nodeFs();
    if (!fs) throw new Error(`${source}: not a URL, and there is no file system`);
    return fs.promises.readFile(source, "utf8");
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  return response.text();
}

/**
 * Runs the script in the global scope, where the toplevel puts `globalThis.ocaml`. In a worker it is
 * started from a `blob:` URL, as the frontend starts the evaluator itself (the script is on another
 * origin, which `importScripts` could load too, but a blob needs no CORS and no second request). Where
 * there is no `importScripts` (Node), it runs as a function in the global scope, as in a browser (see {@link runInNode}).
 */
export function runScript(script: string): void {
  const scope = globalThis as { importScripts?: (url: string) => void };
  if (typeof scope.importScripts === "function" && typeof URL.createObjectURL === "function") {
    const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
    try {
      scope.importScripts(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  } else {
    runInNode(script);
  }
}

/**
 * Under Node (the tests, the grader's host) js_of_ocaml's runtime takes Node for the machine: it uses
 * the real file system, runs `Sys.command` as a shell command, and reads the environment. A program
 * that a student wrote would then read and write the grader's files and run commands on it. So the
 * script is started as it is in a browser: without `require`, and with `process` hidden while it loads
 * (the runtime decides then which file system to use), so that the only file system is the in-memory
 * one and `Sys.command` fails (exit code 127). `process` is back when it has loaded; the environment
 * a program can read is that of the worker, which is for the host to limit.
 */
function runInNode(script: string): void {
  const scope = globalThis as { process?: unknown };
  const descriptor = Object.getOwnPropertyDescriptor(scope, "process");
  Object.defineProperty(scope, "process", { value: undefined, configurable: true, writable: true });
  try {
    new Function("require", script)(undefined);
  } finally {
    if (descriptor) Object.defineProperty(scope, "process", descriptor);
    else delete scope.process;
  }
}

/**
 * Where a file that is published next to the toplevel is: `menhir.js` and `ocamllex.js`, which run on
 * the `.mly` and `.mll` files of a program.
 */
export function siblingUrl(name: string, toplevel: string = configuredUrl()): string {
  return toplevel.replace(/[^/\\]*$/, name);
}

/** Fetches the toplevel bundle and starts it; one that is already loaded is used as it is. */
export async function loadToplevel(source: string = configuredUrl()): Promise<Toplevel> {
  const loaded = (globalThis as { ocaml?: Toplevel }).ocaml;
  if (loaded) return loaded;
  let script: string;
  try {
    script = await fetchScript(source);
  } catch (cause) {
    throw new Error(
      `Could not load the OCaml toplevel: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  runScript(script);
  const top = (globalThis as { ocaml?: Toplevel }).ocaml;
  if (!top)
    throw new Error(
      `Could not start the OCaml toplevel from ${source}: it did not define \`ocaml\``,
    );
  return top;
}
