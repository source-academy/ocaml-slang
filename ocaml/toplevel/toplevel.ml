(* The OCaml toplevel for js_of_ocaml, with MenhirLib linked in (from the phase 0 spike, ocaml-slang#2).
   Exposes globalThis.ocaml with:
     exec(code)             run toplevel phrases; returns everything printed (output, values, errors)
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

let exec code =
  protect (fun () ->
      let lexbuf = Lexing.from_string code in
      Location.init lexbuf "//toplevel//";
      let phrases = !Toploop.parse_use_file lexbuf in
      List.iter (fun ph -> ignore (Toploop.execute_phrase true ppf ph)) phrases)

let mod_use path = protect (fun () -> ignore (Toploop.mod_use_input ppf (Toploop.File path)))

let () =
  Js_of_ocaml_toplevel.initialize ();
  Js.Unsafe.global##.ocaml :=
    object%js
      method exec s = Js.string (exec (Js.to_string s))
      method writeFile p c = Sys_js.create_file ~name:(Js.to_string p) ~content:(Js.to_string c)
      method modUse p = Js.string (mod_use (Js.to_string p))
    end
