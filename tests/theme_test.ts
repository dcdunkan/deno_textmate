/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as path from "https://deno.land/std@0.154.0/path/mod.ts";

import { IEmbeddedLanguagesMap } from "../mod.ts";
import { IThemedToken, tokenizeWithTheme } from "./themed_tokenizer.ts";
import { ThemeData } from "./themes.test.ts";
import { Resolver } from "./resolver.ts";

interface IThemesTokens {
  [theme: string]: IThemedToken[];
}

export class ThemeTest {
  private static _readFile(filename: string): string {
    return Deno.readTextFileSync(filename);
  }

  private static _normalizeNewLines(str: string): string {
    return str.split(/\r\n|\n/).join("\n");
  }

  private readonly EXPECTED_FILE_PATH: string;
  private readonly tests: SingleThemeTest[];

  public readonly expected: string;
  public readonly testName: string;
  public actual: string | null;

  constructor(
    THEMES_TEST_PATH: string,
    testFile: string,
    themeDatas: ThemeData[],
    resolver: Resolver,
  ) {
    const TEST_FILE_PATH = path.join(THEMES_TEST_PATH, "tests", testFile);
    const testFileContents = ThemeTest._readFile(TEST_FILE_PATH);

    this.EXPECTED_FILE_PATH = path.join(
      THEMES_TEST_PATH,
      "tests",
      testFile + ".result",
    );
    this.expected = ThemeTest._normalizeNewLines(
      ThemeTest._readFile(this.EXPECTED_FILE_PATH),
    );

    // Determine the language
    const language = resolver.findLanguageByExtension(path.extname(testFile)) ||
      resolver.findLanguageByFilename(testFile);
    if (!language) {
      throw new Error("Could not determine language for " + testFile);
    }
    const grammar = resolver.findGrammarByLanguage(language);

    const embeddedLanguages: IEmbeddedLanguagesMap = Object.create(null);
    if (grammar.embeddedLanguages) {
      for (const scopeName in grammar.embeddedLanguages) {
        embeddedLanguages[scopeName] =
          resolver.language2id[grammar.embeddedLanguages[scopeName]];
      }
    }

    this.tests = [];
    for (const themeData of themeDatas) {
      this.tests.push(
        new SingleThemeTest(
          themeData,
          testFileContents,
          grammar.scopeName,
          resolver.language2id[language],
          embeddedLanguages,
        ),
      );
    }

    this.testName = testFile;
    this.actual = null;
  }

  // deno-lint-ignore no-explicit-any
  public async evaluate(): Promise<any> {
    await Promise.all(this.tests.map((t) => t.evaluate()));

    const actual: IThemesTokens = {};
    for (let i = 0; i < this.tests.length; i++) {
      actual[this.tests[i].themeData.themeName] = this.tests[i].actual!;
    }

    this.actual = ThemeTest._normalizeNewLines(
      JSON.stringify(actual, null, "\t"),
    );
  }

  public writeExpected(): void {
    Deno.writeTextFileSync(this.EXPECTED_FILE_PATH, this.actual!);
  }
}

class SingleThemeTest {
  public readonly themeData: ThemeData;
  private readonly contents: string;
  private readonly initialScopeName: string;
  private readonly initialLanguage: number;
  private readonly embeddedLanguages: IEmbeddedLanguagesMap;

  public actual: IThemedToken[] | null;

  constructor(
    themeData: ThemeData,
    contents: string,
    initialScopeName: string,
    initialLanguage: number,
    embeddedLanguages: IEmbeddedLanguagesMap,
  ) {
    this.themeData = themeData;
    this.contents = contents;
    this.initialScopeName = initialScopeName;
    this.initialLanguage = initialLanguage;
    this.embeddedLanguages = embeddedLanguages;

    this.actual = null;
  }

  public async evaluate(): Promise<void> {
    this.actual = await this._tokenizeWithThemeAsync();
  }

  private async _tokenizeWithThemeAsync(): Promise<IThemedToken[]> {
    const grammar = await this.themeData.registry
      .loadGrammarWithEmbeddedLanguages(
        this.initialScopeName,
        this.initialLanguage,
        this.embeddedLanguages,
      );
    if (!grammar) {
      throw new Error(`Cannot load grammar for ${this.initialScopeName}`);
    }
    return tokenizeWithTheme(
      this.themeData.registry.getColorMap(),
      this.contents,
      grammar,
    );
  }
}
