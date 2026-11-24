import { fetchScript, runScript, siblingUrl } from "./loader";

export interface ToolResult {
  /** The exit code. */
  code: number;
  stdout: string;
  stderr: string;
  /** The files of `outputs` that the program wrote, by name; null for one that it did not. */
  files: Record<string, string | null>;
}

class Exit {
  constructor(readonly code: number) {}
}

/**
 * Runs a js_of_ocaml program (menhir, ocamllex: scripts/build-tools.sh) once, in this realm: with these
 * arguments, `inputs` as the files of its in-memory file system under `/static`, and `outputs` read back
 * from it when it has finished. Each such program installs its runtime in globals (`jsoo_runtime`, ...),
 * which would replace the toplevel's, so the globals are saved before and put back after.
 */
export function runTool(
  script: string,
  argv: string[],
  inputs: Record<string, string>,
  outputs: string[],
): ToolResult {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = new Map(Object.getOwnPropertyNames(g).map(k => [k, g[k]]));
  let code = 0;
  let stdout = "";
  let stderr = "";
  g.scriptArgs = argv; // where js_of_ocaml looks for them in a worker, or in QuickJS
  // under Node it takes them from process.argv: [node, program, arguments...]
  const process = g.process as { argv: string[] } | undefined;
  const savedArgv = process?.argv;
  if (process) process.argv = [savedArgv?.[0] ?? "node", ...argv];
  g.jsoo_fs_tmp = Object.entries(inputs).map(([name, content]) => ({
    name: `/static/${name}`,
    content,
  }));
  g.quit = (c: number) => {
    throw new Exit(c);
  };
  g.jsoo_tool_output = (fd: number, text: string) => {
    if (fd === 1) stdout += text;
    else stderr += text;
  };
  const files: Record<string, string | null> = {};
  try {
    try {
      runScript(script);
    } catch (e) {
      if (e instanceof Exit) code = e.code;
      else if (e instanceof Error)
        throw e; // a bug of ours
      else code = 2; // an exception of OCaml's that nothing caught: the tool failed
    }
    const read = g.jsoo_read_file as (name: string) => string | null;
    for (const name of outputs) files[name] = read(`/static/${name}`);
  } finally {
    if (process && savedArgv) process.argv = savedArgv;
    for (const k of Object.getOwnPropertyNames(g)) {
      if (!saved.has(k)) delete g[k];
      else if (!Object.is(saved.get(k), g[k])) g[k] = saved.get(k); // (NaN is not equal to itself)
    }
  }
  return { code, stdout, stderr, files };
}

/** What a tool made from a source file. */
export interface Generated {
  ml: string;
  /** For a `.mly`: the interface, which has the tokens. */
  mli?: string;
  /** What the tool said although it succeeded (Menhir's warnings about conflicts). */
  notes: string;
}

export type Generation = Generated | { message: string };

/** The text of a tool's messages, with the in-memory file system's directory taken out of file names. */
const tidy = (text: string): string => text.split("/static/").join("").trim();

/**
 * Generated code has line directives (`# 5 "/static/parser.mly"`) that make OCaml's errors in
 * semantic actions point into the `.mly`; they name the file as the tool was given it.
 */
const withoutDirectory = (code: string): string => code.split('"/static/').join('"');

/** The tools, fetched when first used (they are published next to the toplevel) and kept. */
export class Tools {
  private readonly scripts = new Map<string, Promise<string>>();
  /** What was generated, by source: a file is generated again only if its text changed. */
  private readonly generated = new Map<string, Generation>();

  private script(name: "menhir" | "ocamllex"): Promise<string> {
    let script = this.scripts.get(name);
    if (!script) {
      script = fetchScript(siblingUrl(`${name}.js`)).catch((cause: unknown) => {
        this.scripts.delete(name); // the next run tries again
        throw new Error(
          `Could not load ${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      });
      this.scripts.set(name, script);
    }
    return script;
  }

  /** Starts fetching a tool, so that it is there when a program needs it. */
  preload(name: "menhir" | "ocamllex"): void {
    this.script(name).catch(() => undefined);
  }

  /** `lexer.mll` into `lexer.ml`, with `ocamllex -ml`. */
  async generateLexer(file: string, source: string): Promise<Generation> {
    return this.cached("ocamllex", file, source, async () => {
      const result = runTool(
        await this.script("ocamllex"),
        ["ocamllex", "-ml", "-q", `/static/${file}`],
        { [file]: source },
        [file.replace(/\.mll$/, ".ml")],
      );
      const ml = result.files[file.replace(/\.mll$/, ".ml")];
      if (result.code !== 0 || ml === null) {
        return { message: tidy(result.stderr + result.stdout) || `ocamllex failed on ${file}` };
      }
      return { ml: withoutDirectory(ml), notes: tidy(result.stderr + result.stdout) };
    });
  }

  /** `parser.mly` into `parser.ml` and `parser.mli`, with `menhir --table` (the parser needs MenhirLib). */
  async generateParser(file: string, source: string): Promise<Generation> {
    return this.cached("menhir", file, source, async () => {
      const base = file.replace(/\.mly$/, "");
      const result = runTool(
        await this.script("menhir"),
        ["menhir", "--table", `/static/${file}`],
        { [file]: source },
        [`${base}.ml`, `${base}.mli`],
      );
      const ml = result.files[`${base}.ml`];
      const mli = result.files[`${base}.mli`];
      if (result.code !== 0 || ml === null) {
        return { message: tidy(result.stderr + result.stdout) || `menhir failed on ${file}` };
      }
      return {
        ml: withoutDirectory(ml),
        mli: mli === null || mli === undefined ? undefined : withoutDirectory(mli),
        notes: tidy(result.stderr + result.stdout),
      };
    });
  }

  private async cached(
    tool: string,
    file: string,
    source: string,
    generate: () => Promise<Generation>,
  ): Promise<Generation> {
    const key = `${tool}\0${file}\0${source}`;
    const known = this.generated.get(key);
    if (known) return known;
    const made = await generate();
    this.generated.set(key, made);
    return made;
  }
}
