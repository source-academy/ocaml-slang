// Linked into menhir and ocamllex when they are compiled to JavaScript (scripts/build-tools.sh), so that the
// evaluator can run them in-process, in a worker or under Node, and get at what they write:
//   * globalThis.jsoo_read_file(name): the contents of a file that the program wrote to its in-memory
//     file system (parser.ml), or null;
//   * what the program writes to stdout and stderr goes to globalThis.jsoo_tool_output(fd, text), if
//     that is set (else it is left as js_of_ocaml has it: the console, or the process's streams).
// The input files and the arguments come from globalThis.jsoo_fs_tmp and globalThis.scriptArgs, and a
// call of exit from globalThis.quit: those are js_of_ocaml's own.

//Always
//Requires: caml_read_file_content, caml_sys_file_exists, caml_string_of_jsstring
//Requires: caml_jsstring_of_string, caml_sys_fds
function jsoo_host_setup() {
  globalThis.jsoo_read_file = function (name) {
    var n = caml_string_of_jsstring(name);
    if (!caml_sys_file_exists(n)) return null;
    return caml_jsstring_of_string(caml_read_file_content(n));
  };
  [1, 2].forEach(function (fd) {
    var descriptor = caml_sys_fds[fd];
    if (!descriptor) return;
    var file = descriptor.file;
    var write = file.write;
    file.write = function (buf, pos, len, raise_unix) {
      var sink = globalThis.jsoo_tool_output;
      if (typeof sink !== "function") return write.call(file, buf, pos, len, raise_unix);
      sink(fd, new TextDecoder().decode(buf.subarray(pos, pos + len)));
      return len;
    };
  });
}
jsoo_host_setup();
