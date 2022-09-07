<div align="center">

# TextMate

</div>

A library that helps tokenize text using TextMate grammars.

Deno port of
[Microsoft/vscode-textmate](https://github.com/Microsoft/vscode-textmate). See
original license [here](./LICENSE-MICROSOFT).

An interpreter for grammar files as defined by TextMate. TextMate grammars use
the oniguruma dialect (https://github.com/kkos/oniguruma). Supports loading
grammar files from JSON or PLIST format. Cross-grammar injections are currently
not supported.

You can import this module from

- https://ghc.deno.dev/dcdunkan/deno_textmate/mod.ts
- or from GitHub raw links.

Tests:

```shell
deno test -A --ignore=test-cases
```

For any other information: https://github.com/Microsoft/vscode-textmate

## Example

```ts
import {
  INITIAL,
  parseRawGrammar,
  Registry,
} from "https://ghc.deno.dev/dcdunkan/deno_textmate/mod.ts";
import {
  loadWASM,
  OnigScanner,
  OnigString,
} from "https://esm.sh/vscode-oniguruma@1.6.2";

// https://github.com/microsoft/vscode-oniguruma/blob/main/out/onig.wasm
const wasmFile = await Deno.readFile("./onig.wasm");
const wasmBin = wasmFile.buffer;
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
      // https://github.com/textmate/javascript.tmbundle/blob/master/Syntaxes/JavaScript.plist
      const grammarFileContent = await Deno.readTextFile("./JavaScript.plist");
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
```

Output:

```
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

Tokenizing line: 	return "Hello, " + name;
 - token from 0 to 1 (	) with scopes source.js
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
```

Run the example using Deno CLI:

```shell
deno run --allow-env=VSCODE_TEXTMATE_DEBUG --allow-read --allow-net https://ghc.deno.dev/dcdunkan/deno_textmate/example.ts
```

---

Credits and copyright of the code goes to Microsoft. I only ported this to Deno.
Changed a few lines and fixed `deno lint` errors. Thats it, didn't even fix or
improve anything.

Why?

I ported this originally for porting [Shiki](https://github.com/shikijs/shiki)
to Deno. It cannot be imported from esm.sh or skypack due to some dependency
issues (vscode-textmate!). I don't know if that is an actual issue with esm.sh
or whatever. Anyways it is always nice to have a Deno version. I don't want to
wait for it to be fixed. SO.
