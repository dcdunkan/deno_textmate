/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "https://deno.land/std@0.154.0/path/mod.ts";
import * as assert from "https://deno.land/std@0.154.0/node/assert/strict.ts";
import {
  IGrammar,
  parseRawGrammar,
  Registry,
  RegistryOptions,
  StateStack,
} from "../mod.ts";
import { IOnigLib } from "../onig_lib.ts";
import { getOniguruma } from "./onig_libs.ts";
import { IRawGrammar } from "../raw_grammar.ts";

const REPO_ROOT = path.join(path.fromFileUrl(import.meta.url), "../../");

function assertTokenizationSuite(testLocation: string): void {
  interface IRawTest {
    desc: string;
    grammars: string[];
    grammarPath?: string;
    grammarScopeName?: string;
    grammarInjections?: string[];
    lines: IRawTestLine[];
  }
  interface IRawTestLine {
    line: string;
    tokens: IRawToken[];
  }
  interface IRawToken {
    value: string;
    scopes: string[];
  }

  const tests: IRawTest[] = JSON.parse(
    Deno.readTextFileSync(testLocation),
  );

  tests.map((tst) => {
    Deno.test(tst.desc, async () => {
      await performTest(tst, getOniguruma());
    });
  });

  async function performTest(
    test: IRawTest,
    onigLib: Promise<IOnigLib>,
  ): Promise<void> {
    let grammarScopeName = test.grammarScopeName;
    const grammarByScope: { [scope: string]: IRawGrammar } = {};
    for (const grammarPath of test.grammars) {
      const content = Deno.readTextFileSync(
        path.join(path.dirname(testLocation), grammarPath),
      ).toString();
      const rawGrammar = parseRawGrammar(content, grammarPath);
      grammarByScope[rawGrammar.scopeName] = rawGrammar;
      if (!grammarScopeName && grammarPath === test.grammarPath) {
        grammarScopeName = rawGrammar.scopeName;
      }
    }
    if (!grammarScopeName) {
      throw new Error("I HAVE NO GRAMMAR FOR TEST");
    }

    const options: RegistryOptions = {
      onigLib: onigLib,
      loadGrammar: (scopeName: string) =>
        Promise.resolve(grammarByScope[scopeName]),
      getInjections: (scopeName: string) => {
        if (scopeName === grammarScopeName) {
          return test.grammarInjections;
        }
      },
    };
    const registry = new Registry(options);
    const grammar: IGrammar | null = await registry.loadGrammar(
      grammarScopeName,
    );
    if (!grammar) {
      throw new Error("I HAVE NO GRAMMAR FOR TEST");
    }
    let prevState: StateStack | null = null;
    for (let i = 0; i < test.lines.length; i++) {
      prevState = assertLineTokenization(grammar, test.lines[i], prevState);
    }
  }

  function assertLineTokenization(
    grammar: IGrammar,
    testCase: IRawTestLine,
    prevState: StateStack | null,
  ): StateStack {
    const actual = grammar.tokenizeLine(testCase.line, prevState);

    const actualTokens: IRawToken[] = actual.tokens.map((token) => {
      return {
        value: testCase.line.substring(token.startIndex, token.endIndex),
        scopes: token.scopes,
      };
    });

    // TODO@Alex: fix tests instead of working around
    if (testCase.line.length > 0) {
      // Remove empty tokens...
      testCase.tokens = testCase.tokens.filter((token) => {
        return (token.value.length > 0);
      });
    }

    assert.deepStrictEqual(
      actualTokens,
      testCase.tokens,
      "Tokenizing line " + testCase.line,
    );

    return actual.ruleStack;
  }
}

assertTokenizationSuite(
  path.join(REPO_ROOT, "test-cases/first-mate/tests.json"),
);
assertTokenizationSuite(path.join(REPO_ROOT, "test-cases/suite1/tests.json"));
assertTokenizationSuite(
  path.join(REPO_ROOT, "test-cases/suite1/whileTests.json"),
);
