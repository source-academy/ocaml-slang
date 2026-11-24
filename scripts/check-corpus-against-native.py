#!/usr/bin/env python3
"""Compares the output of the corpus programs with native OCaml's (`ocaml file.ml`).

The `.expected` files of corpus/ say what the evaluator sends; this checks, when they are made or
changed, that the programs print what real OCaml prints. Needs `ocaml` on the PATH (the opam switch).
Differences that are expected are skipped or explained:
  - cases with an error (nothing, or less, runs natively), and the ones that document js_of_ocaml
    (32-bit int) or MenhirLib;
  - the value of the last expression, which a native script does not print;
  - warnings and anything else on stderr: the evaluator sends them as output, so the messages that
    native OCaml wrote to stderr are removed from ours before the comparison.
"""
import glob
import re
import subprocess
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "corpus"
# whitespace, and the location of a message (`File "x.ml", line 1, characters 0-5:` natively,
# `Line 1, characters 0-5:` in the toplevel) do not count
norm = lambda s: re.sub(r"\s+", " ", re.sub(r'(File "[^"]*", l|L)ine \d+, characters \d+-\d+:', "", s)).strip()
checked = different = 0
for path in sorted(glob.glob(f"{root}/**/*.ml", recursive=True)):
    expected = open(path + ".expected").read()
    if re.search(r"^error", expected, re.M) or "int-width" in path or "menhirlib" in path:
        continue
    run = subprocess.run(["ocaml", path], capture_output=True, text=True)
    native = run.stdout
    # native OCaml quotes the source under a location (`1 | let ...` and a line of ^^^); the toplevel does not
    stderr = "\n".join(l for l in run.stderr.split("\n") if not re.match(r"^\s*(\d+ \|.*|\^+)\s*$", l))
    # what native OCaml wrote to stderr, as blocks (a warning is several lines) and as single lines
    native_err = {norm(b) for b in re.split(r"\n\s*\n|\n(?=File )", stderr)} | {norm(l) for l in stderr.split("\n")}
    # the messages of the evaluator: `out: text`, with the further lines of a message indented
    messages = re.split(r"^out: ", "\n".join(l for l in expected.split("\n") if not l.startswith("--- ")), flags=re.M)[1:]
    messages = [m.replace("\n    ", "\n") for m in messages]
    # what native OCaml wrote to stderr (warnings, prerr_endline) is output of the evaluator
    messages = [m for m in messages if not norm(m) or norm(m) not in native_err]
    ours = "\n".join(messages)
    checked += 1
    n, o = norm(native), norm(ours)
    if not (o == n or (o.startswith(n) and len(o) - len(n) < 80)):  # the last value may follow
        different += 1
        print("DIFFERENT", path, "\n  native:", n[:300], "\n  ours:  ", o[:300])
print(f"checked {checked}, different {different}")
sys.exit(1 if different else 0)
