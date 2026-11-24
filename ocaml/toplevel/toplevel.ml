(* The OCaml toplevel for js_of_ocaml, with MenhirLib linked in (from the phase 0 spike, ocaml-slang#2).
   Exposes globalThis.ocaml with:
     run(code, onOutput)    run the phrases of a chunk, all or none (a syntax or type error rejects the
                            chunk before any phrase runs). What the program writes to stdout and stderr,
                            and the warnings, go to onOutput(text) as it is flushed. Returns
                              ok      false if the chunk was rejected or raised
                              result  the phrases' results in the toplevel's style ("- : int = 6")
                              value   the last phrase's value without its type ("6") if that phrase is an
                                      expression whose type is not unit, else null
                              error   null, or {message, line, column, endLine, endColumn}: OCaml's
                                      message, and its location (1-based lines, 0-based columns, in
                                      bytes of the UTF-8 source; line is 0 if there is none)
     reset()                start a new session
     writeFile(path, text)  put a file on the pseudo file system
     modUse(path)           load path.ml as a module (like #mod_use) *)
open Js_of_ocaml

(* What the program prints: stdout and stderr, and the warnings (which the compiler prints to
   stderr), go to [emit] when they are flushed. *)
let emit : (string -> unit) ref = ref ignore

(* Reading stdin finds the end of the input at once. (Under Node, js_of_ocaml would otherwise read the
   process's real stdin and wait for it. The conductor's input is asynchronous, which a toplevel that
   runs synchronously cannot wait for.) *)
let () =
  Sys_js.set_channel_flusher stdout (fun s -> !emit s);
  Sys_js.set_channel_flusher stderr (fun s -> !emit s);
  Sys_js.set_channel_filler stdin (fun () -> "")

let flush_output () =
  Format.pp_print_flush Format.err_formatter ();
  Format.pp_print_flush Format.std_formatter ();
  flush stdout;
  flush stderr

(* What the toplevel prints for a phrase (a value, a signature, an uncaught exception) is captured
   here by [Toploop.print_out_phrase], so that it is not mixed with the program's output. Errors that
   [Toploop.execute_phrase] prints itself, those of directives, go to [ppf]. *)
type phrase = { text : string; value : string option; raised : bool }

(* The phrases printed since the last reset, latest first: a directive such as #use runs several. *)
let captured : phrase list ref = ref []
let errbuf = Buffer.create 256
let ppf = Format.formatter_of_buffer errbuf (* the log of the current phrase, in order *)

let () =
  let original = !Toploop.print_out_phrase in
  Toploop.print_out_phrase :=
    fun _ phr ->
      (* The value is printed once (a printer from #install_printer may have effects, and a
         printer for a type is run for each value it prints) and then shown as it is. *)
      let phr, value =
        match phr with
        | Outcometree.Ophr_eval (v, ty) ->
            let printed = String.trim (Format.asprintf "%a" !Toploop.print_out_value v) in
            (Outcometree.Ophr_eval (Oval_stuff printed, ty), Some printed)
        | _ -> (phr, None)
      in
      let text = String.trim (Format.asprintf "%a" original phr) in
      let raised = match phr with Outcometree.Ophr_exception _ -> true | _ -> false in
      captured := { text; value; raised } :: !captured;
      (* One log, in order, with what directives and nested errors write to [ppf]. *)
      if not raised then begin
        Format.pp_print_string ppf text;
        Format.pp_print_newline ppf ()
      end

type error = { message : string; loc : Location.t option }

(* OCaml's message for an exception, without the location, which is reported separately. *)
let error_of_exn exn =
  match exn with
  | Stack_overflow -> { message = "Stack overflow"; loc = None }
  | _ -> (
      match Location.error_of_exn exn with
      | Some (`Ok report) ->
          let printer =
            { Location.batch_mode_printer with pp_main_loc = (fun _ _ _ _ -> ()) }
          in
          { message = String.trim (Format.asprintf "@[<v>%a@]" (printer.pp printer) report);
            loc = Some report.main.loc }
      | _ -> { message = Printexc.to_string exn; loc = None })

(* A chunk is rejected as a whole: its phrases are parsed (a syntax error rejects it) and then
   type checked in sequence, each in the environment that the previous one leaves, before any
   is run. Type checking has no effect on the session, except for warnings, which are silenced
   here and reported by the run. A directive (#use, #mod_use, #load) changes the environment in
   ways that only running it shows, so the check stops at the first one: the phrases after it are
   checked just before each runs. *)
let silent = Format.make_formatter (fun _ _ _ -> ()) (fun () -> ())

let without_warnings f =
  let saved = !Location.formatter_for_warnings in
  Location.formatter_for_warnings := silent;
  Fun.protect ~finally:(fun () -> Location.formatter_for_warnings := saved) f

let typecheck env = function
  | Parsetree.Ptop_def sstr ->
      let _, _, env = Topcommon.typecheck_phrase silent env sstr in
      env
  | Parsetree.Ptop_dir _ -> env

(* Whether the phrase is an expression of type unit, aliases of unit included. *)
let is_unit_expression env = function
  | Parsetree.Ptop_def sstr -> (
      try
        let str, _, _ = without_warnings (fun () -> Topcommon.typecheck_phrase silent env sstr) in
        match List.rev str.Typedtree.str_items with
        | { str_desc = Tstr_eval (e, _); _ } :: _ -> (
            match Types.get_desc (Ctype.expand_head e.exp_env e.exp_type) with
            | Tconstr (p, _, _) -> Path.same p Predef.path_unit
            | _ -> false)
        | _ -> false
      with _ -> false)
  | Parsetree.Ptop_dir _ -> false

(* Checks the phrases up to the first directive; returns how many it checked. *)
let check phrases =
  without_warnings (fun () ->
      let rec go n env = function
        | (Parsetree.Ptop_def _ as ph) :: rest -> go (n + 1) (typecheck env ph) rest
        | Parsetree.Ptop_dir _ :: _ | [] -> n
      in
      go 0 !Toploop.toplevel_env phrases)

exception Failed

(* A phrase that is just an expression, as [fact 5;;] is: the toplevel prints [let _ = fact 5;;] as
   a value too, but that one is a definition. *)
let is_expression = function
  | Parsetree.Ptop_def [ { pstr_desc = Pstr_eval _; _ } ] -> true
  | _ -> false

type outcome = { result : string; value : string option; error : error option }

let run code on_output =
  emit := on_output;
  let result = Buffer.create 64 in
  let value = ref None in
  let error = ref None in
  let fail e =
    error := Some e;
    raise Failed
  in
  (try
     (try
        let lexbuf = Lexing.from_string code in
        Location.init lexbuf "//toplevel//";
        let phrases = !Toploop.parse_use_file lexbuf in
        let checked = check phrases in
        List.iteri
          (fun i ph ->
            (* After a directive, a phrase is checked just before it runs, for the same errors. *)
            if i >= checked then ignore (without_warnings (fun () -> typecheck !Toploop.toplevel_env ph));
            let unit_expression = is_expression ph && is_unit_expression !Toploop.toplevel_env ph in
            captured := [];
            Buffer.clear errbuf;
            let ok = Toploop.execute_phrase true ppf ph in
            Format.pp_print_flush ppf ();
            flush_output ();
            let printed = List.rev !captured in
            let add text =
              if text <> "" then begin
                if Buffer.length result > 0 then Buffer.add_char result '\n';
                Buffer.add_string result text
              end
            in
            (* What a directive wrote to the formatter, and what it printed before it failed, is shown. *)
            if ok then begin
              add (String.trim (Buffer.contents errbuf));
              value :=
                match List.rev printed with
                | l :: _ when is_expression ph && not unit_expression -> l.value
                | _ -> None
            end
            else begin
              match List.find_opt (fun l -> l.raised) printed with
              | Some l ->
                  add (String.trim (Buffer.contents errbuf));
                  fail { message = l.text; loc = None }
              | None -> fail { message = String.trim (Buffer.contents errbuf); loc = None }
            end)
          phrases
      with
     | Failed -> ()
     | e -> error := Some (error_of_exn e));
     if !error <> None then value := None
   with Failed -> ());
  flush_output ();
  emit := ignore;
  { result = Buffer.contents result; value = !value; error = !error }

(* A new session: the typing environment and the settings that directives change (#warnings,
   #rectypes, #directory, #print_depth, ...) as they were when the toplevel started. Printers
   that #install_printer registered stay, but they are keyed by the paths of the old session's
   values, which the new environment doesn't have. *)
type settings = {
  warnings : Warnings.state;
  paths : Load_path.paths;
  recursive_types : bool;
  principal : bool;
  strict_sequence : bool;
  applicative_functors : bool;
  unsafe : bool;
  print_depth : int;
  print_length : int;
}

let current_settings () =
  { warnings = Warnings.backup ();
    paths = Load_path.get_paths ();
    recursive_types = !Clflags.recursive_types;
    principal = !Clflags.principal;
    strict_sequence = !Clflags.strict_sequence;
    applicative_functors = !Clflags.applicative_functors;
    unsafe = !Clflags.unsafe;
    print_depth = !Toploop.max_printer_depth;
    print_length = !Toploop.max_printer_steps }

let initial_settings = lazy (current_settings ())

let reset () =
  let i = Lazy.force initial_settings in
  Warnings.restore i.warnings;
  Load_path.init ~auto_include:Load_path.no_auto_include ~visible:i.paths.visible
    ~hidden:i.paths.hidden;
  Clflags.recursive_types := i.recursive_types;
  Clflags.principal := i.principal;
  Clflags.strict_sequence := i.strict_sequence;
  Clflags.applicative_functors := i.applicative_functors;
  Clflags.unsafe := i.unsafe;
  Toploop.max_printer_depth := i.print_depth;
  Toploop.max_printer_steps := i.print_length;
  Toploop.initialize_toplevel_env ()

(* Loads a file as a module; what it prints and the errors come back as text. *)
let mod_use path =
  let out = Buffer.create 256 in
  emit := Buffer.add_string out;
  Buffer.clear errbuf;
  captured := [];
  (try ignore (Toploop.mod_use_input ppf (Toploop.File path))
   with e -> Buffer.add_string out (error_of_exn e).message);
  Format.pp_print_flush ppf ();
  flush_output ();
  emit := ignore;
  Buffer.contents out ^ Buffer.contents errbuf

let () =
  Js_of_ocaml_toplevel.initialize ();
  ignore (Lazy.force initial_settings);
  Js.Unsafe.global##.ocaml :=
    object%js
      method run s on_output =
        let o =
          run (Js.to_string s) (fun text ->
              ignore (Js.Unsafe.fun_call on_output [| Js.Unsafe.inject (Js.string text) |]))
        in
        object%js
          val ok = Js.bool (o.error = None)
          val result = Js.string o.result
          val value =
            match o.value with Some v -> Js.some (Js.string v) | None -> Js.null
          val error =
            match o.error with
            | None -> Js.null
            | Some e ->
                let line, column, end_line, end_column =
                  match e.loc with
                  | Some { loc_start; loc_end; loc_ghost = _ } when loc_start.pos_lnum > 0 ->
                      ( loc_start.pos_lnum,
                        loc_start.pos_cnum - loc_start.pos_bol,
                        loc_end.pos_lnum,
                        loc_end.pos_cnum - loc_end.pos_bol )
                  | _ -> (0, 0, 0, 0)
                in
                Js.some
                  (object%js
                     val message = Js.string e.message
                     val line = line
                     val column = column
                     val endLine = end_line
                     val endColumn = end_column
                   end)
        end
      method reset = reset ()
      method writeFile p c = Sys_js.create_file ~name:(Js.to_string p) ~content:(Js.to_string c)
      method modUse p = Js.string (mod_use (Js.to_string p))
    end
