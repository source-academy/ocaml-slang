#!/usr/bin/env python3
"""Compares the output of the corpus programs with native OCaml's (`ocaml file.ml`).

The `.expected` files of corpus/ say what the evaluator sends; this checks, when they are made or
changed, that the programs print what real OCaml prints. Needs `ocaml` on the PATH (the opam switch).
Differences that are expected are skipped or explained:
  - cases with an error (nothing, or less, runs natively), and the ones that document js_of_ocaml
    (32-bit int) or MenhirLib;
  - the value of the last expression, which a native script does not print;
  - warnings and stderr, which a native script prints to stderr and the evaluator sends as output.
"""
import glob
import re
import subprocess
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "corpus"
norm = lambda s: re.sub(r"\s+", " ", s).strip()
checked = different = 0
for path in sorted(glob.glob(f"{root}/**/*.ml", recursive=True)):
    expected = open(path + ".expected").read()
    if re.search(r"^error", expected, re.M) or "int-width" in path or "menhirlib" in path:
        continue
    native = subprocess.run(["ocaml", path], capture_output=True, text=True).stdout
    # the messages of the evaluator: `out: text`, with the further lines of a message indented
    messages = re.split(r"^out: ", "\n".join(l for l in expected.split("\n") if not l.startswith("--- ")), flags=re.M)[1:]
    messages = [m.replace("\n    ", "\n") for m in messages]
    # a warning (stderr natively) and what goes to stderr are not in a native script's stdout
    messages = [m for m in messages if not re.match(r"Line \d+, characters \d+-\d+:\nWarning", m) and m.strip() != "to stderr"]
    ours = "\n".join(messages)
    checked += 1
    n, o = norm(native), norm(ours)
    if not (o == n or (o.startswith(n) and len(o) - len(n) < 80)):  # the last value may follow
        different += 1
        print("DIFFERENT", path, "\n  native:", n[:300], "\n  ours:  ", o[:300])
print(f"checked {checked}, different {different}")
sys.exit(1 if different else 0)
