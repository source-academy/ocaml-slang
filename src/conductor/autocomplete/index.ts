import {
  WEB_PLUGIN_ID,
  type AutoCompleteEntry,
  type SyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { BaseAutoCompleteRunnerPlugin } from "@sourceacademy/runner-autocomplete";
import ocamlMode from "./mode";

/**
 * Gives the frontend what it needs to highlight OCaml (ocaml-slang#44), as py-slang does for Python.
 * It completes nothing yet: that would need Merlin (#30).
 */
export default class OCamlAutoCompletePlugin extends BaseAutoCompleteRunnerPlugin {
  get mode(): SyntaxHighlightData {
    return ocamlMode();
  }

  autocomplete(): AutoCompleteEntry[] {
    return [];
  }
}

export function registerAutoCompletePlugin(conductor: IRunnerPlugin): void {
  conductor.registerPlugin(OCamlAutoCompletePlugin);
  // a host that cannot load it just has no highlighting
  conductor.hostLoadPlugin(WEB_PLUGIN_ID).catch(() => undefined);
}
