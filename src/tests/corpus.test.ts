/**
 * The corpus (ocaml-slang#12): programs in `corpus/` with what the evaluator sends for them, in
 * `.expected` files next to them. It is the check for every upgrade of OCaml, js_of_ocaml or the
 * toplevel: a difference shows up as a failing case, and the new behaviour is accepted by looking at
 * the diff of the `.expected` files that `UPDATE_CORPUS=1 yarn test corpus` writes.
 *
 * - `name.ml` is run as the editor's program (`evaluateFile`).
 * - `name.repl` is a session: chunks, separated by a line `(* --- *)`, each sent to `evaluateChunk`
 *   after a fresh session starts.
 * - `projects/case/` is a program of several files: the files are in the folder `/project`, and
 *   each `entry.ml.expected` there is for running `entry.ml` as the file open in the editor (`main.ml`
 *   is run if it has no other entry).
 *
 * An `.expected` file lists the messages in the order they were sent, one entry per message:
 *   out: text           (further lines of a message are indented by 4 spaces)
 *   error L:C-L:C: text (or `error: text` if OCaml gave no location); lines 1-based, columns 0-based
 *                        in editor characters
 * and, for a session, `--- chunk N` before the messages of each chunk.
 */
import type { ConductorError } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import { OCamlEvaluator } from "../conductor/OCamlEvaluator";

const bundle = resolve(__dirname, "../../dist/ocaml-toplevel.js");
const root = resolve(__dirname, "../../corpus");
const update = process.env.UPDATE_CORPUS === "1";

function files(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
}

function indent(text: string): string {
  return text.split("\n").join("\n    ");
}

type Recorder = { conductor: IRunnerPlugin; lines: string[] };

function recorder(folder: Record<string, string> = {}): Recorder {
  const lines: string[] = [];
  const conductor = {
    sendOutput: (text: string) => lines.push(`out: ${indent(text)}`),
    requestFile: (path: string) => Promise.resolve(folder[path]),
    sendError: (
      e: ConductorError & {
        line?: number;
        column?: number;
        endLine?: number;
        endColumn?: number;
        rawMessage?: string;
      },
    ) => {
      const where =
        e.line === undefined ? "" : ` ${e.line}:${e.column}-${e.endLine}:${e.endColumn}`;
      lines.push(`error${where}: ${indent(e.rawMessage ?? e.message)}`);
    },
  } as unknown as IRunnerPlugin;
  return { conductor, lines };
}

async function runCase(path: string): Promise<string> {
  const source = readFileSync(path, "utf8");
  const { conductor, lines } = recorder();
  const evaluator = new OCamlEvaluator(conductor);
  if (path.endsWith(".repl")) {
    await evaluator.evaluateFile("session.ml", ""); // a fresh session
    const chunks = source.split(/^\(\* --- \*\)\n/m);
    for (const [i, chunk] of chunks.entries()) {
      lines.push(`--- chunk ${i + 1}`);
      await evaluator.evaluateChunk(chunk);
    }
  } else {
    await evaluator.evaluateFile(path, source);
  }
  return lines.join("\n") + "\n";
}

const projectsRoot = join(root, "projects");
const isProjectFile = (f: string) => f.startsWith(projectsRoot + "/");
const cases = files(root).filter(
  f => (f.endsWith(".ml") || f.endsWith(".repl")) && !isProjectFile(f),
);

/** The entries of a project: the files with an `.expected`, and `main.ml`. */
function projects(): { dir: string; entry: string; expected: string }[] {
  return readdirSync(projectsRoot)
    .sort()
    .flatMap(name => {
      const dir = join(projectsRoot, name);
      const entries = new Set(
        readdirSync(dir)
          .filter(f => f.endsWith(".expected"))
          .map(f => f.slice(0, -".expected".length)),
      );
      if (existsSync(join(dir, "main.ml"))) entries.add("main.ml");
      return [...entries]
        .sort()
        .map(entry => ({ dir, entry, expected: join(dir, `${entry}.expected`) }));
    });
}

async function runProject(dir: string, entry: string): Promise<string> {
  const folder: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".expected"))
      folder[`/project/${name}`] = readFileSync(join(dir, name), "utf8");
  }
  const { conductor, lines } = recorder(folder);
  await new OCamlEvaluator(conductor).evaluateFile(
    `/project/${entry}`,
    folder[`/project/${entry}`],
  );
  return lines.join("\n") + "\n";
}

describe("corpus", () => {
  beforeAll(() => {
    if (!existsSync(bundle)) throw new Error(`${bundle} is missing: run 'yarn build:ocaml' first`);
    (globalThis as { OCAML_SLANG_TOPLEVEL_URL?: string }).OCAML_SLANG_TOPLEVEL_URL = bundle;
  });

  test("has cases", () => expect(cases.length).toBeGreaterThan(40));

  test("every case has an expected file, and every expected file a case", () => {
    const expected = files(root).filter(f => f.endsWith(".expected") && !isProjectFile(f));
    expect(expected.map(f => f.slice(0, -".expected".length)).sort()).toEqual(
      update ? expected.map(f => f.slice(0, -".expected".length)).sort() : [...cases].sort(),
    );
  });

  test.each(projects().map(p => [relative(root, p.expected), p]))("%s", async (_name, p) => {
    const actual = await runProject(p.dir, p.entry);
    if (update) {
      writeFileSync(p.expected, actual);
      return;
    }
    expect(existsSync(p.expected)).toBe(true);
    expect(actual).toBe(readFileSync(p.expected, "utf8"));
  });

  test.each(cases.map(c => [relative(root, c), c]))("%s", async (_name, path) => {
    const actual = await runCase(path);
    const expectedPath = `${path}.expected`;
    if (update) {
      writeFileSync(expectedPath, actual);
      return;
    }
    expect(existsSync(expectedPath)).toBe(true);
    expect(actual).toBe(readFileSync(expectedPath, "utf8"));
  });
});
