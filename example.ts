import { INITIAL, parseRawGrammar, Registry } from "./mod.ts";
import {
  loadWASM,
  OnigScanner,
  OnigString,
} from "https://esm.sh/vscode-oniguruma@1.6.2";

const response = await fetch(
  "https://raw.githubusercontent.com/microsoft/vscode-oniguruma/main/out/onig.wasm",
);
if (!response.ok) throw new Error("Failed to fetch 'onig.wasm'");
const wasmBin = await response.arrayBuffer();
const vscodeOnigurumaLib = loadWASM(wasmBin).then(() => {
  return {
    createOnigScanner(patterns: string[]) {
      return new OnigScanner(patterns);
    },
    createOnigString(str: string) {
      return new OnigString(str);
    },
  };
});

// Create a registry that can create a grammar from a scope name.
const registry = new Registry({
  onigLib: vscodeOnigurumaLib,
  loadGrammar: async (scopeName) => {
    if (scopeName === "source.js") {
      const response = await fetch(
        "https://raw.githubusercontent.com/textmate/javascript.tmbundle/master/Syntaxes/JavaScript.plist",
      );
      if (!response.ok) throw new Error("Failed to fetch 'JavaScript.plist'");
      const grammarFileContent = await response.text();
      return parseRawGrammar(grammarFileContent);
    }
    console.log(`Unknown scope name: ${scopeName}`);
  },
});

// Load the JavaScript grammar and any other grammars included by it async.
registry.loadGrammar("source.js").then((grammar) => {
  if (!grammar) return;
  const text = [
    `function sayHello(name) {`,
    `\treturn "Hello, " + name;`,
    `}`,
  ];
  let ruleStack = INITIAL;
  for (let i = 0; i < text.length; i++) {
    const line = text[i];
    const lineTokens = grammar.tokenizeLine(line, ruleStack);
    console.log(`\nTokenizing line: ${line}`);
    for (let j = 0; j < lineTokens.tokens.length; j++) {
      const token = lineTokens.tokens[j];
      console.log(
        ` - token from ${token.startIndex} to ${token.endIndex} ` +
          `(${line.substring(token.startIndex, token.endIndex)}) ` +
          `with scopes ${token.scopes.join(", ")}`,
      );
    }
    ruleStack = lineTokens.ruleStack;
  }
});

/* OUTPUT:

Unknown scope name: source.js.regexp

Tokenizing line: function sayHello(name) {
 - token from 0 to 8 (function) with scopes source.js, meta.function.js, storage.type.function.js
 - token from 8 to 9 ( ) with scopes source.js, meta.function.js
 - token from 9 to 17 (sayHello) with scopes source.js, meta.function.js, entity.name.function.js
 - token from 17 to 18 (() with scopes source.js, meta.function.js, punctuation.definition.parameters.begin.js
 - token from 18 to 22 (name) with scopes source.js, meta.function.js, variable.parameter.function.js
 - token from 22 to 23 ()) with scopes source.js, meta.function.js, punctuation.definition.parameters.end.js
 - token from 23 to 24 ( ) with scopes source.js
 - token from 24 to 25 ({) with scopes source.js, punctuation.section.scope.begin.js

Tokenizing line:        return "Hello, " + name;
 - token from 0 to 1 (  ) with scopes source.js
 - token from 1 to 7 (return) with scopes source.js, keyword.control.js
 - token from 7 to 8 ( ) with scopes source.js
 - token from 8 to 9 (") with scopes source.js, string.quoted.double.js, punctuation.definition.string.begin.js
 - token from 9 to 16 (Hello, ) with scopes source.js, string.quoted.double.js
 - token from 16 to 17 (") with scopes source.js, string.quoted.double.js, punctuation.definition.string.end.js
 - token from 17 to 18 ( ) with scopes source.js
 - token from 18 to 19 (+) with scopes source.js, keyword.operator.arithmetic.js
 - token from 19 to 20 ( ) with scopes source.js
 - token from 20 to 24 (name) with scopes source.js, support.constant.dom.js
 - token from 24 to 25 (;) with scopes source.js, punctuation.terminator.statement.js

Tokenizing line: }
 - token from 0 to 1 (}) with scopes source.js, punctuation.section.scope.end.js

*/
