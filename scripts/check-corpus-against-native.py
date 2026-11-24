#!/usr/bin/env python3
"""Compares the output of the corpus programs with native OCaml's (`ocaml file.ml`).

The `.expected` files of corpus/ say what the evaluator sends; this checks, when they are made or
changed, that the programs print what real OCaml prints. Needs `ocaml`, `ocamlfind` and `ocamldep` on the PATH (the opam switch). Programs of several files
(`projects/`) are compiled natively, in dependency order, and run.
Differences that are expected are skipped or explained:
  - cases with an error (nothing, or less, runs natively), and the ones that document js_of_ocaml
    (32-bit int) or MenhirLib;
  - the value of the last expression, which a native script does not print;
  - warnings and anything else on stderr: the evaluator sends them as output, so the messages that
    native OCaml wrote to stderr are removed from ours before the comparison.
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "corpus")
# whitespace, and the location of a message (`File "x.ml", line 1, characters 0-5:` natively,
# `Line 1, characters 0-5:` in the toplevel) do not count
norm = lambda s: re.sub(r"\s+", " ", re.sub(r'(File "[^"]*", l|L)ine \d+, characters \d+-\d+:', "", s)).strip()
checked = different = 0


def compare(label, expected, native_stdout, native_stderr):
    """Whether our messages, less what native OCaml put on stderr, are its output (and maybe the last value)."""
    global checked, different
    # native OCaml quotes the source under a location (`1 | let ...` and a line of ^^^); the toplevel does not
    stderr = "\n".join(l for l in native_stderr.split("\n") if not re.match(r"^\s*(\d+ \|.*|\^+)\s*$", l))
    # what native OCaml wrote to stderr, as blocks (a warning is several lines) and as single lines
    native_err = {norm(b) for b in re.split(r"\n\s*\n|\n(?=File )", stderr)} | {norm(l) for l in stderr.split("\n")} | {norm(stderr)}
    # the messages of the evaluator: `out: text`, with the further lines of a message indented
    messages = re.split(r"^out: ", "\n".join(l for l in expected.split("\n") if not l.startswith("--- ")), flags=re.M)[1:]
    messages = [m.replace("\n    ", "\n") for m in messages]
    # what native OCaml wrote to stderr (warnings, prerr_endline) is output of the evaluator
    messages = [m for m in messages if not norm(m) or norm(m) not in native_err]
    n, o = norm(native_stdout), norm("\n".join(messages))
    checked += 1
    if not (o == n or (o.startswith(n) and len(o) - len(n) < 80)):  # the last value may follow
        different += 1
        print("DIFFERENT", label, "\n  native:", n[:300], "\n  ours:  ", o[:300])


for path in sorted(glob.glob(f"{root}/**/*.ml", recursive=True)):
    if "/projects/" in path:
        continue
    expected = open(path + ".expected").read()
    if re.search(r"^error", expected, re.M) or "int-width" in path or "menhirlib" in path:
        continue
    run = subprocess.run(["ocaml", path], capture_output=True, text=True)
    compare(path, expected, run.stdout, run.stderr)

# Programs of several files: compiled and run natively, from the files that the entry refers to
# (the closure that `ocamldep` finds), in the order `ocamldep -sort` gives.
def modules_of(f):
    out = subprocess.run(["ocamldep", "-modules", f], capture_output=True, text=True)
    if ":" not in out.stdout:
        raise SystemExit(f"ocamldep failed on {f}: {out.stderr[:300]}")
    return out.stdout.split(":", 1)[1].split()


for expected_path in sorted(glob.glob(f"{root}/projects/*/*.ml.expected")):
    entry = expected_path[: -len(".expected")]
    directory = os.path.dirname(entry)
    expected = open(expected_path).read()
    if re.search(r"^error", expected, re.M):
        continue
    generated = glob.glob(f"{directory}/*.mll") + glob.glob(f"{directory}/*.mly")
    if generated:
        # Lexers and parsers: made natively with ocamllex and Menhir (--table), then compiled with MenhirLib,
        # in a copy that holds only the files that the entry refers to (the evaluator reads no others). This
        # checks the tools that run in the browser against the native ones.
        with tempfile.TemporaryDirectory() as tmp:
            tool_stderr = ""  # what the tools say, as the evaluator sends it as output
            entry_name = os.path.basename(entry)
            shutil.copy(entry, tmp)
            by_module = {}
            for f in glob.glob(f"{directory}/*"):
                base = os.path.basename(f)
                if "." in base and not base.endswith(".expected"):
                    by_module.setdefault(base.split(".")[0][0].upper() + base.split(".")[0][1:], []).append(f)
            done, todo = set(), [entry_name]
            while todo:
                current = todo.pop()
                deps = set()
                for f in sorted(glob.glob(f"{tmp}/{current.split('.')[0]}.ml*")) if current != entry_name else [f"{tmp}/{entry_name}"]:
                    if f.endswith((".ml", ".mli")):
                        deps |= set(modules_of(f))
                for module in deps:
                    for f in by_module.get(module, []):
                        stem = os.path.basename(f)
                        if stem in done:
                            continue
                        done.add(stem)
                        shutil.copy(f, tmp)
                        if f.endswith(".mll"):
                            tool_stderr += subprocess.run(["ocamllex", "-ml", "-q", f"{tmp}/{stem}"], check=True, capture_output=True, text=True).stderr
                        if f.endswith(".mly"):
                            tool_stderr += subprocess.run(["menhir", "--table", "--explain", stem], check=True, capture_output=True, text=True, cwd=tmp).stderr
                            report = f"{tmp}/{stem[:-4]}.conflicts"  # what --explain wrote, which the evaluator sends too
                            if os.path.exists(report):
                                tool_stderr += "\n" + open(report).read()
                        todo.append(stem)
            sources = [os.path.basename(f) for f in glob.glob(f"{tmp}/*.ml") + glob.glob(f"{tmp}/*.mli")]
            order = subprocess.run(["ocamldep", "-sort"] + [f for f in sources if f != entry_name], capture_output=True, text=True, cwd=tmp).stdout.split()
            exe = os.path.join(tmp, "program")
            build = subprocess.run(
                ["ocamlfind", "ocamlopt", "-package", "menhirLib", "-linkpkg", "-w", "-a", "-o", exe] + order + [entry_name],
                capture_output=True, text=True, cwd=tmp)
            if build.returncode != 0:
                different += 1
                print("DOES NOT COMPILE", entry, build.stderr[:300])
                continue
            run = subprocess.run([exe], capture_output=True, text=True)
            compare(entry, expected, run.stdout, run.stderr + build.stderr + tool_stderr)
        continue

    names = {os.path.basename(f)[0].upper() + os.path.basename(f)[1:].split(".")[0]: f for f in glob.glob(f"{directory}/*.ml")}
    needed, todo = set(), [entry]
    while todo:
        f = todo.pop()
        if f in needed:
            continue
        needed.add(f)
        todo += [names[m] for m in modules_of(f) if m in names and names[m] != entry]
        mli = f + "i"
        if os.path.exists(mli):
            needed.add(mli)
            todo += [names[m] for m in modules_of(mli) if m in names]
    others = sorted(needed - {entry})
    order = subprocess.run(["ocamldep", "-sort"] + others, capture_output=True, text=True).stdout.split()
    with tempfile.TemporaryDirectory() as tmp:
        # compile in a copy, so that the .cmi, .cmx and .o files do not land beside the corpus
        for f in needed | {entry}:
            shutil.copy(f, tmp)
        exe = os.path.join(tmp, "program")
        build = subprocess.run(
            ["ocamlfind", "ocamlopt", "-w", "+a-4-9-26-27-32..42-44-45-70", "-o", exe]
            + [os.path.basename(f) for f in order]
            + [os.path.basename(entry)],
            capture_output=True, text=True, cwd=tmp)
        if build.returncode != 0:
            different += 1
            print("DOES NOT COMPILE", entry, build.stderr[:300])
            continue
        run = subprocess.run([exe], capture_output=True, text=True)
        # warnings appear while compiling natively, and while running here: put them with stderr
        compare(entry, expected, run.stdout, run.stderr + build.stderr)
print(f"checked {checked}, different {different}")
sys.exit(1 if different else 0)
