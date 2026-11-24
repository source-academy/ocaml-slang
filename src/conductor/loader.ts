import type { Toplevel } from "./toplevel";

/** Where the toplevel bundle is published: next to the evaluator, on GitHub Pages. */
export const TOPLEVEL_URL = "https://source-academy.github.io/ocaml-slang/ocaml-toplevel.js";

/**
 * Where to fetch the toplevel from, if not {@link TOPLEVEL_URL}: set `OCAML_SLANG_TOPLEVEL_URL` on
 * the global object before the evaluator starts. Under Node (the tests, the grader's host) it can
 * also be the path of a file, which needs no network.
 */
function configuredUrl(): string {
  const url = (globalThis as { OCAML_SLANG_TOPLEVEL_URL?: unknown }).OCAML_SLANG_TOPLEVEL_URL;
  return typeof url === "string" && url !== "" ? url : TOPLEVEL_URL;
}

type NodeRequire = (id: string) => unknown;
type NodeFs = { promises: { readFile(path: string, encoding: "utf8"): Promise<string> } };

/** Node's `require`, which the evaluator's script does not have as a global (and the toplevel's runtime wants). */
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
 * there is no `importScripts` (Node), it runs as a function in the global scope, given Node's `require`.
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
    new Function("require", script)(nodeRequire());
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
