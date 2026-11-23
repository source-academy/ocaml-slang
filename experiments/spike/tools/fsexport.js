// Spike: lets the host read files that a js_of_ocaml program wrote to its in-memory
// file system (e.g. parser.ml written by menhir), after the program has run.

//Always
//Requires: caml_read_file_content, caml_sys_file_exists, caml_string_of_jsstring
//Requires: caml_jsstring_of_string
function jsoo_spike_fsexport() {
  globalThis.jsoo_read_file = function (name) {
    var n = caml_string_of_jsstring(name);
    if (!caml_sys_file_exists(n)) return null;
    return caml_jsstring_of_string(caml_read_file_content(n));
  };
}
jsoo_spike_fsexport();
