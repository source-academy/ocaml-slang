// js_of_ocaml compiles caml_ensure_stack_capacity as a no-op in whole programs
// (parse_bytecode.ml), but the runtime has no such primitive for code that the
// toplevel compiles at run time. The bytecode compiler emits it for functions with
// large stack frames, e.g. Menhir's generated parsers. JS stacks grow by themselves.

//Provides: caml_ensure_stack_capacity
function caml_ensure_stack_capacity(required_space) {
  return 0;
}
