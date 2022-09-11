/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as debug from "../debug.ts";
import { getOniguruma } from "./onig_libs.ts";
import { IGrammar, parseRawGrammar, Registry } from "../mod.ts";
import {
  Grammar as GrammarImpl,
  StackElement as StackElementImpl,
} from "../grammar.ts";

// deno-lint-ignore no-unused-vars
class ExtendedStackElement extends StackElementImpl {
  _instanceId?: number;
}

debug.DebugFlags.InDebugMode = true;

if (Deno.args.length < 4) {
  console.log(
    "usage: deno run -A index.ts <mainGrammarPath> [<additionalGrammarPath1> ...] <filePath>",
  );
  Deno.exit(0);
}

const GRAMMAR_PATHS = Deno.args.slice(2, Deno.args.length - 1);
const FILE_PATH = Deno.args[Deno.args.length - 1];

const registry = new Registry({
  onigLib: getOniguruma(),
  loadGrammar: () => Promise.resolve(null),
});
const grammarPromises: Promise<IGrammar>[] = [];
for (const path of GRAMMAR_PATHS) {
  console.log("LOADING GRAMMAR: " + path);
  const content = Deno.readTextFileSync(path);
  const rawGrammar = parseRawGrammar(content, path);
  grammarPromises.push(registry.addGrammar(rawGrammar));
}

Promise.all(grammarPromises).then((_grammars) => {
  const grammar = _grammars[0];
  const fileContents = Deno.readTextFileSync(FILE_PATH);
  const lines = fileContents.split(/\r\n|\r|\n/);
  let ruleStack = null;
  let lastElementId = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    console.log("");
    console.log("");
    console.log("===========================================");
    console.log("TOKENIZING LINE " + (i + 1) + ": |" + line + "|");

    const r = grammar.tokenizeLine(line, ruleStack);

    console.log("");

    let stackElement: ExtendedStackElement | null = <ExtendedStackElement> r
      .ruleStack;
    let cnt = 0;
    while (stackElement) {
      cnt++;
      stackElement = stackElement.parent;
    }

    console.log("@@LINE END RULE STACK CONTAINS " + cnt + " RULES:");
    stackElement = <ExtendedStackElement> r.ruleStack;
    const list: string[] = [];
    while (stackElement) {
      if (!stackElement._instanceId) {
        stackElement._instanceId = ++lastElementId;
      }
      const ruleDesc = (<GrammarImpl> grammar).getRule(stackElement.ruleId);
      if (!ruleDesc) {
        list.push(
          "  * no rule description found for rule id: " + stackElement.ruleId,
        );
      } else {
        list.push(
          "  * " + ruleDesc.debugName + "  -- [" + ruleDesc.id + "," +
            stackElement._instanceId + '] "' +
            stackElement.nameScopesList.generateScopes() + '", "' +
            stackElement.contentNameScopesList.generateScopes() + '"',
        );
      }
      stackElement = stackElement.parent;
    }
    list.reverse();
    console.log(list.join("\n"));

    ruleStack = r.ruleStack;
  }
});
