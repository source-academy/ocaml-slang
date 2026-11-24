import type { ILink } from "@sourceacademy/conductor/conduit";
import { initialise } from "@sourceacademy/conductor/runner";
import { registerAutoCompletePlugin } from "./autocomplete";
import { OCamlEvaluator } from "./index";

/**
 * Where the evaluator talks to its host. In a browser worker that is `self` (the conductor's default).
 * Under Node, as in the grader's host (source-academy/grader#415), the evaluator runs in a
 * `worker_threads` thread, which has no `self`: its end of the link is `parentPort`.
 */
function nodeLink(): ILink {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a worker script is CommonJS
  const { parentPort } = require("worker_threads") as typeof import("worker_threads");
  if (!parentPort) throw new Error("The OCaml evaluator must run in a worker");
  const port = parentPort;
  return {
    postMessage: (message: unknown, transfer?: unknown) =>
      port.postMessage(message, transfer as never),
    addEventListener: (type: string, listener: unknown) =>
      port.on(type, (data: unknown) => (listener as (e: { data: unknown }) => void)({ data })),
  } as unknown as ILink;
}

const { runnerPlugin } = initialise(
  OCamlEvaluator,
  typeof self === "undefined" ? nodeLink() : undefined,
);
// The frontend highlights with what the evaluator sends; a grader's host has no editor.
if (typeof self !== "undefined") registerAutoCompletePlugin(runnerPlugin);
