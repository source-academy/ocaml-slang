import type { Toplevel, ToplevelError } from "./toplevel";

/** A module of a program of several files: `lexer.ml`, and `lexer.mli` if there is one. */
export interface ProjectModule {
  /** `Lexer`. */
  name: string;
  /** Names to show in messages: the file names, without the directory. */
  mlFile: string;
  ml: string;
  mliFile?: string;
  mli?: string;
}

/** A failure to put the program together: an error of OCaml's in a file, or a message. */
export type ProjectFailure = { error: ToplevelError } | { message: string };

export type Project =
  | {
      /** In dependency order, dependencies first; the entry is not among them. */
      modules: ProjectModule[];
      /** The text of each file by the name that messages show. */
      sources: Record<string, string>;
    }
  | { failure: ProjectFailure; sources: Record<string, string> };

const directory = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1);
const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const uncapitalize = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** The module of a file: `/playground/lexer.ml` is `Lexer`. */
export function moduleOfFile(path: string): string {
  const base = basename(path);
  const dot = base.indexOf(".");
  return capitalize(dot < 0 ? base : base.slice(0, dot));
}

/**
 * Finds the modules of a program of several files, as `ocamldep` and dune do for a directory: the
 * module `Foo` that a file refers to is `foo.ml` (or `Foo.ml`), with `foo.mli`, in the directory of
 * the entry. Files are requested by name, since a conductor cannot list a folder; a name with no file
 * there is not a module of the program (it is in the Stdlib, or it is unbound, which OCaml says). The
 * entry is the file that is run, and it runs last. A cycle is an error.
 */
export async function discoverProject(
  top: Toplevel,
  requestFile: (path: string) => Promise<string | undefined>,
  entryPath: string,
  entrySource: string,
): Promise<Project> {
  const dir = directory(entryPath);
  const entryName = moduleOfFile(entryPath);
  const sources: Record<string, string> = {};
  const found = new Map<string, ProjectModule & { deps: string[] }>();
  const missing = new Set<string>();

  // The entry is not a module of the program: it runs last, and nothing can refer to it. A reference
  // to a module of its name, from it or from another file, is to the Stdlib's (a file of the program
  // called `format.ml` that is run may use `Format`) or unbound, which OCaml says.
  const parse = (file: string, source: string, kind: "ml" | "mli" | "entry") =>
    top.dependencies(file, source, kind);

  const entryDeps = parse("//toplevel//", entrySource, "entry");
  if (entryDeps.error) return { failure: { error: entryDeps.error }, sources };
  sources["//toplevel//"] = entrySource;
  const edges = new Map<string, string[]>([[entryName, entryDeps.deps]]);

  const firstOf = async (names: string[], extension: string) => {
    for (const name of new Set(names)) {
      const content = await requestFile(`${dir}${name}.${extension}`);
      if (content !== undefined) return { file: `${name}.${extension}`, content };
    }
    return undefined;
  };

  let pending = entryDeps.deps;
  while (pending.length > 0) {
    const names = [...new Set(pending)].filter(
      n => n !== entryName && !found.has(n) && !missing.has(n),
    );
    pending = [];
    const looked = await Promise.all(
      names.map(async name => {
        const candidates = [uncapitalize(name), name];
        const [ml, mli] = await Promise.all([
          firstOf(candidates, "ml"),
          firstOf(candidates, "mli"),
        ]);
        return { name, ml, mli };
      }),
    );
    for (const { name, ml, mli } of looked) {
      if (!ml && !mli) {
        missing.add(name);
        continue;
      }
      if (!ml && mli) {
        return {
          failure: {
            message: `Error: The interface ${mli.file} has no implementation (${uncapitalize(name)}.ml)`,
          },
          sources,
        };
      }
      const module: ProjectModule & { deps: string[] } = {
        name,
        mlFile: ml!.file,
        ml: ml!.content,
        mliFile: mli?.file,
        mli: mli?.content,
        deps: [],
      };
      sources[ml!.file] = ml!.content;
      const mlDeps = parse(ml!.file, ml!.content, "ml");
      if (mlDeps.error) return { failure: { error: mlDeps.error }, sources };
      module.deps = mlDeps.deps;
      if (mli) {
        sources[mli.file] = mli.content;
        const mliDeps = parse(mli.file, mli.content, "mli");
        if (mliDeps.error) return { failure: { error: mliDeps.error }, sources };
        module.deps = [...new Set([...module.deps, ...mliDeps.deps])];
      }
      found.set(name, module);
      edges.set(name, module.deps);
      pending.push(...module.deps);
    }
  }

  // Dependency order, by depth first search from the entry; a way back to a module on the path is a cycle.
  const order: ProjectModule[] = [];
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];
  const fileOf = (name: string) =>
    name === entryName ? basename(entryPath) : found.get(name)!.mlFile;
  let cycle: string[] | undefined;
  const visit = (name: string): void => {
    if (cycle) return;
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") {
      cycle = [...path.slice(path.indexOf(name)), name];
      return;
    }
    state.set(name, "visiting");
    path.push(name);
    for (const dep of edges.get(name) ?? []) if (found.has(dep)) visit(dep);
    path.pop();
    state.set(name, "done");
    if (name !== entryName) order.push(found.get(name)!); // the entry is last, not in the list
  };
  visit(entryName);
  if (cycle) {
    return {
      failure: {
        message: `Error: Circular dependency between the files: ${cycle.map(fileOf).join(" -> ")}`,
      },
      sources,
    };
  }
  return { modules: order, sources };
}
