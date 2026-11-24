import { ConductorError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { OCamlError } from "./errors";
import { loadToplevel } from "./loader";
import { discoverProject } from "./project";
import { Tools } from "./tools";
import type { RunResult, Toplevel } from "./toplevel";

/**
 * The conductor evaluator (ocaml-slang#9). A chunk is a sequence of toplevel phrases, run in one
 * session, so a chunk sees what earlier chunks defined, as in `ocaml`. A chunk with a syntax or type
 * error is rejected as a whole and leaves the session unchanged. Running a file starts a new session.
 *
 * The toplevel bundle is fetched when the evaluator starts (loader.ts), so that loading overlaps with
 * the student typing. A run shows what the program prints and the value of its last phrase; a chunk
 * shows what the program prints and the results as the toplevel does (#10). Errors carry OCaml's
 * message and its line and column.
 */
export class OCamlEvaluator extends BasicEvaluator {
  private loading?: Promise<Toplevel>;
  /** menhir and ocamllex, for the `.mly` and `.mll` files of a program (fetched when one needs them). */
  private readonly tools = new Tools();

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    // Start loading at once, so that the toplevel is there when the first program runs; a failure
    // is reported by that run, not here.
    this.toplevel().catch(() => undefined);
  }

  /** The toplevel, loaded when first asked for. A load that failed is dropped, and the next run tries again. */
  private toplevel(): Promise<Toplevel> {
    const loading = (this.loading ??= loadToplevel());
    loading.catch(() => {
      if (this.loading === loading) this.loading = undefined;
    });
    return loading;
  }

  /**
   * A run of the editor's program: a new session; shows what the program prints, and the value of its
   * last phrase. `fileName` is the file open in the editor: it runs last, after the files of its
   * directory that it refers to, as modules (see project.ts).
   */
  async evaluateFile(fileName: string, fileContent: string): Promise<void> {
    try {
      const top = await this.toplevel();
      top.reset();
      const project = await discoverProject(
        top,
        path => this.requestFile(path),
        fileName,
        fileContent,
        this.tools,
      );
      if ("failure" in project) {
        const failure = project.failure;
        this.conductor.sendError(
          "error" in failure
            ? new OCamlError(failure.error, fileContent, project.sources)
            : new ConductorError(failure.message),
        );
        return;
      }
      // What the tools said although they succeeded (Menhir's warnings about conflicts)
      for (const { text } of project.notes) this.out(text);
      if (project.modules.length === 0) return await this.run(fileContent, "file");
      const { modules } = project;
      this.show(
        top.runProgram(
          modules.map(m => m.name),
          modules.map(m => m.mlFile),
          modules.map(m => m.ml),
          modules.map(m => m.mliFile ?? ""),
          modules.map(m => m.mli ?? ""),
          fileContent,
          this.out,
        ),
        "file",
        fileContent,
        project.sources,
      );
    } catch (e) {
      this.fail(e);
    }
  }

  /** The file of the program that the conductor has under this path, if it can give it. */
  private async requestFile(path: string): Promise<string | undefined> {
    try {
      return await this.conductor.requestFile(path);
    } catch {
      return undefined;
    }
  }

  /** A phrase or more typed in the REPL: shows what the program prints, and the results as the toplevel does. */
  evaluateChunk(chunk: string): Promise<void> {
    return this.run(chunk, "chunk");
  }

  /** What the program prints goes out as it is flushed. Each message is an entry of the REPL, so the newline that ends it is dropped. */
  private readonly out = (text: string) => {
    if (text !== "") this.conductor.sendOutput(text.replace(/\n$/, ""));
  };

  private async run(code: string, mode: "file" | "chunk"): Promise<void> {
    try {
      const top = await this.toplevel();
      this.show(top.run(code, this.out), mode, code, {});
    } catch (e) {
      this.fail(e);
    }
  }

  /** Sends the outcome of a run: the error, or the value of a run, or the results of a chunk. */
  private show(
    r: RunResult,
    mode: "file" | "chunk",
    source: string,
    others: Record<string, string>,
  ): void {
    if (r.error) {
      if (mode === "chunk") this.out(r.result);
      this.conductor.sendError(new OCamlError(r.error, source, others));
    } else if (mode === "file") {
      // A value whose printer prints nothing is still the result: send it, though it is empty.
      if (r.value !== null) this.conductor.sendOutput(r.value.replace(/\n$/, ""));
    } else {
      this.out(r.result);
    }
  }

  private fail(e: unknown): void {
    this.conductor.sendError(
      e instanceof ConductorError
        ? e
        : new ConductorError(e instanceof Error ? e.message : String(e)),
    );
  }
}
