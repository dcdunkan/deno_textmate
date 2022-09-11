/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { assertEquals, dirname, fromFileUrl, join } from "./deps.ts";
import {
  IGrammar,
  parseRawGrammar,
  Registry,
  RegistryOptions,
  StackElement,
} from "../mod.ts";
import { IOnigLib, IRawGrammar } from "../types.ts";
import { getOniguruma } from "./onig_libs.ts";

const REPO_ROOT = join(fromFileUrl(import.meta.url), "../../");

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

  const tests: IRawTest[] = JSON.parse(Deno.readTextFileSync(testLocation));

  tests.forEach((test) => {
    Deno.test(test.desc, async () => {
      await performTest(test, getOniguruma());
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
        join(dirname(testLocation), grammarPath),
      );
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
    let prevState: StackElement | null = null;
    for (let i = 0; i < test.lines.length; i++) {
      prevState = assertLineTokenization(grammar, test.lines[i], prevState);
    }
  }

  function assertLineTokenization(
    grammar: IGrammar,
    testCase: IRawTestLine,
    prevState: StackElement | null,
  ): StackElement {
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

    assertEquals(
      actualTokens,
      testCase.tokens,
      "Tokenizing line " + testCase.line,
    );

    return actual.ruleStack;
  }
}

assertTokenizationSuite(join(REPO_ROOT, "test-cases/first-mate/tests.json"));
assertTokenizationSuite(join(REPO_ROOT, "test-cases/suite1/tests.json"));
assertTokenizationSuite(join(REPO_ROOT, "test-cases/suite1/whileTests.json"));
