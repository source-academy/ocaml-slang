(* The OCaml toplevel for js_of_ocaml, with MenhirLib linked in (from the phase 0 spike, ocaml-slang#2).
   Exposes globalThis.ocaml with:
     run(code)              run the phrases of a chunk, all or none: {ok, output}, output being everything
                            printed (output, values, errors); a syntax or type error rejects the chunk
     exec(code)             run(code).output
     reset()                start a new session
     writeFile(path, text)  put a file on the pseudo file system
     modUse(path)           load path.ml as a module (like #mod_use) *)
open Js_of_ocaml

let buf = Buffer.create 4096
let ppf = Format.formatter_of_buffer buf

let () =
  Sys_js.set_channel_flusher stdout (Buffer.add_string buf);
  Sys_js.set_channel_flusher stderr (Buffer.add_string buf)

let finish () =
  Format.pp_print_flush ppf ();
  flush stdout;
  flush stderr;
  let s = Buffer.contents buf in
  Buffer.clear buf;
  s

let protect f =
  (try f () with
   | Stack_overflow -> Format.fprintf ppf "Stack overflow@."
   | e -> Location.report_exception ppf e);
  finish ()

(* A chunk is rejected as a whole: its phrases are parsed (a syntax error rejects it) and then
   type checked in sequence, each in the environment that the previous one leaves, before any
   is run. Type checking has no effect on the session, except for warnings, which are silenced
   here and reported by the run. *)
let silent = Format.make_formatter (fun _ _ _ -> ()) (fun () -> ())

let check phrases =
  let saved = !Location.formatter_for_warnings in
  Location.formatter_for_warnings := silent;
  Fun.protect
    ~finally:(fun () -> Location.formatter_for_warnings := saved)
    (fun () ->
      ignore
        (List.fold_left
           (fun env -> function
             | Parsetree.Ptop_def sstr ->
                 let _, _, env = Topcommon.typecheck_phrase silent env sstr in
                 env
             | Parsetree.Ptop_dir _ -> env)
           !Toploop.toplevel_env phrases))

exception Failed

(* Runs the phrases of a chunk; stops at the first uncaught exception. [ok] is false for a
   rejected chunk and for one that raised. *)
let run code =
  let ok = ref true in
  (try
     let lexbuf = Lexing.from_string code in
     Location.init lexbuf "//toplevel//";
     let phrases = !Toploop.parse_use_file lexbuf in
     check phrases;
     try List.iter (fun ph -> if not (Toploop.execute_phrase true ppf ph) then raise Failed) phrases
     with Failed -> ok := false
   with
   | Stack_overflow ->
       ok := false;
       Format.fprintf ppf "Stack overflow@."
   | e ->
       ok := false;
       Location.report_exception ppf e);
  let output = finish () in
  (!ok, output)

let exec code = snd (run code)

(* A new session: the environment as it was when the toplevel started. *)
let reset () = Toploop.initialize_toplevel_env ()

let mod_use path = protect (fun () -> ignore (Toploop.mod_use_input ppf (Toploop.File path)))

let () =
  Js_of_ocaml_toplevel.initialize ();
  Js.Unsafe.global##.ocaml :=
    object%js
      method exec s = Js.string (exec (Js.to_string s))
      method run s =
        let ok, output = run (Js.to_string s) in
        object%js
          val ok = Js.bool ok
          val output = Js.string output
        end
      method reset = reset ()
      method writeFile p c = Sys_js.create_file ~name:(Js.to_string p) ~content:(Js.to_string c)
      method modUse p = Js.string (mod_use (Js.to_string p))
    end
