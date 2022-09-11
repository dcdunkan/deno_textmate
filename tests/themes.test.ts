// deno-lint-ignore-file no-explicit-any
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from "https://deno.land/std@0.154.0/path/mod.ts";
import * as assert from "https://deno.land/std@0.154.0/node/assert/strict.ts";
import { Registry } from "../mod.ts";
import {
  ColorMap,
  FontStyle,
  fontStyleToString,
  IRawTheme,
  ParsedThemeRule,
  parseTheme,
  ScopeStack,
  StyleAttributes,
  Theme,
  ThemeTrieElement,
  ThemeTrieElementRule,
} from "../theme.ts";
import { ThemeTest } from "./theme_test.ts";
import { getOniguruma } from "./onig_libs.ts";
import {
  IGrammarRegistration,
  ILanguageRegistration,
  Resolver,
} from "./resolver.ts";
import { strArrCmp, strcmp } from "../utils.ts";
import { parsePLIST } from "../plist.ts";

const THEMES_TEST_PATH = path.join(
  path.fromFileUrl(import.meta.url),
  "../../test-cases/themes",
);

export interface ThemeData {
  themeName: string;
  theme: IRawTheme;
  registry: Registry;
}

class ThemeInfo {
  private _themeName: string;
  private _filename: string;
  private _includeFilename: string | undefined;

  constructor(themeName: string, filename: string, includeFilename?: string) {
    this._themeName = themeName;
    this._filename = filename;
    this._includeFilename = includeFilename;
  }

  private static _loadThemeFile(filename: string): IRawTheme {
    const fullPath = path.join(THEMES_TEST_PATH, filename);
    const fileContents = Deno.readTextFileSync(fullPath);

    if (/\.json$/.test(filename)) {
      return JSON.parse(fileContents);
    }
    return parsePLIST(fileContents);
  }

  public create(resolver: Resolver): ThemeData {
    const theme: IRawTheme = ThemeInfo._loadThemeFile(this._filename);
    if (this._includeFilename) {
      const includeTheme: IRawTheme = ThemeInfo._loadThemeFile(
        this._includeFilename,
      );
      (<any> theme).settings = includeTheme.settings.concat(theme.settings);
    }

    const registry = new Registry(resolver);
    registry.setTheme(theme);

    return {
      themeName: this._themeName,
      theme: theme,
      registry: registry,
    };
  }
}

(function () {
  const THEMES = [
    new ThemeInfo("abyss", "Abyss.tmTheme"),
    new ThemeInfo("dark_vs", "dark_vs.json"),
    new ThemeInfo("light_vs", "light_vs.json"),
    new ThemeInfo("hc_black", "hc_black.json"),
    new ThemeInfo("dark_plus", "dark_plus.json", "dark_vs.json"),
    new ThemeInfo("light_plus", "light_plus.json", "light_vs.json"),
    new ThemeInfo("kimbie_dark", "Kimbie_dark.tmTheme"),
    new ThemeInfo("monokai", "Monokai.tmTheme"),
    new ThemeInfo("monokai_dimmed", "dimmed-monokai.tmTheme"),
    new ThemeInfo("quietlight", "QuietLight.tmTheme"),
    new ThemeInfo("red", "red.tmTheme"),
    new ThemeInfo("solarized_dark", "Solarized-dark.tmTheme"),
    new ThemeInfo("solarized_light", "Solarized-light.tmTheme"),
    new ThemeInfo("tomorrow_night_blue", "Tomorrow-Night-Blue.tmTheme"),
  ];

  // Load all language/grammar metadata
  const _grammars: IGrammarRegistration[] = JSON.parse(
    Deno.readTextFileSync(path.join(THEMES_TEST_PATH, "grammars.json")),
  );
  for (const grammar of _grammars) {
    grammar.path = path.join(THEMES_TEST_PATH, grammar.path);
  }

  const _languages: ILanguageRegistration[] = JSON.parse(
    Deno.readTextFileSync(path.join(THEMES_TEST_PATH, "languages.json")),
  );

  const _resolver = new Resolver(_grammars, _languages, getOniguruma());
  const _themeData = THEMES.map((theme) => theme.create(_resolver));

  // Discover all tests
  let testFiles: string[] = [];
  for (const file of Deno.readDirSync(path.join(THEMES_TEST_PATH, "tests"))) {
    testFiles.push(file.name);
  }

  testFiles = testFiles.filter((testFile) => !/\.result$/.test(testFile));
  testFiles = testFiles.filter((testFile) => !/\.result.patch$/.test(testFile));
  testFiles = testFiles.filter((testFile) => !/\.actual$/.test(testFile));
  testFiles = testFiles.filter((testFile) => !/\.diff.html$/.test(testFile));

  for (const testFile of testFiles) {
    const tst = new ThemeTest(
      THEMES_TEST_PATH,
      testFile,
      _themeData,
      _resolver,
    );
    Deno.test(tst.testName, async () => {
      try {
        await tst.evaluate();
        assert.deepStrictEqual(tst.actual, tst.expected);
      } catch (err) {
        tst.writeExpected();
        throw err;
      }
    });
  }
})();

Deno.test("Theme matching gives higher priority to deeper matches", () => {
  const theme = Theme.createFromRawTheme({
    settings: [
      { settings: { foreground: "#100000", background: "#200000" } },
      {
        scope: "punctuation.definition.string.begin.html",
        settings: { foreground: "#300000" },
      },
      {
        scope: "meta.tag punctuation.definition.string",
        settings: { foreground: "#400000" },
      },
    ],
  });
  const actual = theme.match(
    ScopeStack.from("punctuation.definition.string.begin.html"),
  );
  assert.deepStrictEqual(theme.getColorMap()[actual!.foregroundId], "#300000");
});

Deno.test("Theme matching gives higher priority to parent matches 1", () => {
  const theme = Theme.createFromRawTheme({
    settings: [
      { settings: { foreground: "#100000", background: "#200000" } },
      { scope: "c a", settings: { foreground: "#300000" } },
      { scope: "d a.b", settings: { foreground: "#400000" } },
      { scope: "a", settings: { foreground: "#500000" } },
    ],
  });

  const map = theme.getColorMap();

  assert.deepStrictEqual(
    map[theme.match(ScopeStack.from("d", "a.b"))!.foregroundId],
    "#400000",
  );
});

Deno.test("Theme matching gives higher priority to parent matches 2", () => {
  const theme = Theme.createFromRawTheme({
    settings: [
      { settings: { foreground: "#100000", background: "#200000" } },
      { scope: "meta.tag entity", settings: { foreground: "#300000" } },
      {
        scope: "meta.selector.css entity.name.tag",
        settings: { foreground: "#400000" },
      },
      { scope: "entity", settings: { foreground: "#500000" } },
    ],
  });

  const result = theme.match(
    ScopeStack.from(
      "text.html.cshtml",
      "meta.tag.structure.any.html",
      "entity.name.tag.structure.any.html",
    ),
  );

  const colorMap = theme.getColorMap();
  assert.strictEqual(colorMap[result!.foregroundId], "#300000");
});

Deno.test("Theme matching can match", async (t) => {
  const theme = Theme.createFromRawTheme({
    settings: [
      { settings: { foreground: "#F8F8F2", background: "#272822" } },
      { scope: "source, something", settings: { background: "#100000" } },
      { scope: ["bar", "baz"], settings: { background: "#200000" } },
      { scope: "source.css selector bar", settings: { fontStyle: "bold" } },
      {
        scope: "constant",
        settings: { fontStyle: "italic", foreground: "#300000" },
      },
      { scope: "constant.numeric", settings: { foreground: "#400000" } },
      { scope: "constant.numeric.hex", settings: { fontStyle: "bold" } },
      {
        scope: "constant.numeric.oct",
        settings: { fontStyle: "bold italic underline" },
      },
      {
        scope: "constant.numeric.dec",
        settings: { fontStyle: "", foreground: "#500000" },
      },
      {
        scope: "storage.object.bar",
        settings: { fontStyle: "", foreground: "#600000" },
      },
    ],
  });

  const map = theme.getColorMap();

  function match(...path: string[]) {
    const result = theme.match(ScopeStack.from(...path));
    if (!result) {
      return null;
    }
    const obj: any = {
      fontStyle: fontStyleToString(result.fontStyle),
    };
    if (result.foregroundId !== 0) {
      obj.foreground = map[result.foregroundId];
    }
    if (result.backgroundId !== 0) {
      obj.background = map[result.backgroundId];
    }
    return obj;
  }

  await t.step("simpleMatch1", () =>
    assert.deepStrictEqual(match("source"), {
      background: "#100000",
      fontStyle: "not set",
    }));
  await t.step(
    "simpleMatch2",
    () =>
      assert.deepStrictEqual(match("source.ts"), {
        background: "#100000",
        fontStyle: "not set",
      }),
  );
  await t.step(
    "simpleMatch3",
    () =>
      assert.deepStrictEqual(match("source.tss"), {
        background: "#100000",
        fontStyle: "not set",
      }),
  );
  await t.step(
    "simpleMatch4",
    () =>
      assert.deepStrictEqual(match("something"), {
        background: "#100000",
        fontStyle: "not set",
      }),
  );
  await t.step(
    "simpleMatch5",
    () =>
      assert.deepStrictEqual(match("something.ts"), {
        background: "#100000",
        fontStyle: "not set",
      }),
  );
  await t.step(
    "simpleMatch6",
    () =>
      assert.deepStrictEqual(match("something.tss"), {
        background: "#100000",
        fontStyle: "not set",
      }),
  );
  await t.step("simpleMatch7", () =>
    assert.deepStrictEqual(match("baz"), {
      background: "#200000",
      fontStyle: "not set",
    }));
  await t.step("simpleMatch8", () =>
    assert.deepStrictEqual(match("baz.ts"), {
      background: "#200000",
      fontStyle: "not set",
    }));
  await t.step("simpleMatch9", () =>
    assert.deepStrictEqual(match("baz.tss"), {
      background: "#200000",
      fontStyle: "not set",
    }));
  await t.step(
    "simpleMatch10",
    () =>
      assert.deepStrictEqual(match("constant"), {
        foreground: "#300000",
        fontStyle: "italic",
      }),
  );
  await t.step(
    "simpleMatch11",
    () =>
      assert.deepStrictEqual(match("constant.string"), {
        foreground: "#300000",
        fontStyle: "italic",
      }),
  );
  await t.step(
    "simpleMatch12",
    () =>
      assert.deepStrictEqual(match("constant.hex"), {
        foreground: "#300000",
        fontStyle: "italic",
      }),
  );
  await t.step(
    "simpleMatch13",
    () =>
      assert.deepStrictEqual(match("constant.numeric"), {
        foreground: "#400000",
        fontStyle: "italic",
      }),
  );
  await t.step(
    "simpleMatch14",
    () =>
      assert.deepStrictEqual(match("constant.numeric.baz"), {
        foreground: "#400000",
        fontStyle: "italic",
      }),
  );
  await t.step(
    "simpleMatch15",
    () =>
      assert.deepStrictEqual(match("constant.numeric.hex"), {
        foreground: "#400000",
        fontStyle: "bold",
      }),
  );
  await t.step(
    "simpleMatch16",
    () =>
      assert.deepStrictEqual(match("constant.numeric.hex.baz"), {
        foreground: "#400000",
        fontStyle: "bold",
      }),
  );
  await t.step(
    "simpleMatch17",
    () =>
      assert.deepStrictEqual(match("constant.numeric.oct"), {
        foreground: "#400000",
        fontStyle: "italic bold underline",
      }),
  );
  await t.step(
    "simpleMatch18",
    () =>
      assert.deepStrictEqual(match("constant.numeric.oct.baz"), {
        foreground: "#400000",
        fontStyle: "italic bold underline",
      }),
  );
  await t.step(
    "simpleMatch19",
    () =>
      assert.deepStrictEqual(match("constant.numeric.dec"), {
        foreground: "#500000",
        fontStyle: "none",
      }),
  );
  await t.step(
    "simpleMatch20",
    () =>
      assert.deepStrictEqual(match("constant.numeric.dec.baz"), {
        foreground: "#500000",
        fontStyle: "none",
      }),
  );
  await t.step(
    "simpleMatch21",
    () =>
      assert.deepStrictEqual(match("storage.object.bar"), {
        foreground: "#600000",
        fontStyle: "none",
      }),
  );
  await t.step(
    "simpleMatch22",
    () =>
      assert.deepStrictEqual(match("storage.object.bar.baz"), {
        foreground: "#600000",
        fontStyle: "none",
      }),
  );
  await t.step(
    "simpleMatch23",
    () =>
      assert.deepStrictEqual(match("storage.object.bart"), {
        fontStyle: "not set",
      }),
  );
  await t.step(
    "simpleMatch24",
    () =>
      assert.deepStrictEqual(match("storage.object"), { fontStyle: "not set" }),
  );
  await t.step(
    "simpleMatch25",
    () => assert.deepStrictEqual(match("storage"), { fontStyle: "not set" }),
  );

  await t.step(
    "defaultMatch1",
    () => assert.deepStrictEqual(match(""), { fontStyle: "not set" }),
  );
  await t.step(
    "defaultMatch2",
    () => assert.deepStrictEqual(match("bazz"), { fontStyle: "not set" }),
  );
  await t.step(
    "defaultMatch3",
    () => assert.deepStrictEqual(match("asdfg"), { fontStyle: "not set" }),
  );

  await t.step("multiMatch1", () =>
    assert.deepStrictEqual(match("bar"), {
      background: "#200000",
      fontStyle: "not set",
    }));
  await t.step(
    "multiMatch2",
    () =>
      assert.deepStrictEqual(match("source.css", "selector", "bar"), {
        background: "#200000",
        fontStyle: "bold",
      }),
  );
});

Deno.test("Theme matching Microsoft/vscode#23460", () => {
  const theme = Theme.createFromRawTheme({
    settings: [
      {
        settings: {
          foreground: "#aec2e0",
          background: "#14191f",
        },
      },
      {
        name: "JSON String",
        scope: "meta.structure.dictionary.json string.quoted.double.json",
        settings: {
          foreground: "#FF410D",
        },
      },
      {
        scope: "meta.structure.dictionary.json string.quoted.double.json",
        settings: {
          foreground: "#ffffff",
        },
      },
      {
        scope: "meta.structure.dictionary.value.json string.quoted.double.json",
        settings: {
          foreground: "#FF410D",
        },
      },
    ],
  });

  const path = ScopeStack.from(
    "source.json",
    "meta.structure.dictionary.json",
    "meta.structure.dictionary.value.json",
    "string.quoted.double.json",
  );
  const result = theme.match(path);
  assert.strictEqual(theme.getColorMap()[result!.foregroundId], "#FF410D");
});

Deno.test("Theme parsing can parse", () => {
  const actual = parseTheme({
    settings: [
      { settings: { foreground: "#F8F8F2", background: "#272822" } },
      { scope: "source, something", settings: { background: "#100000" } },
      { scope: ["bar", "baz"], settings: { background: "#010000" } },
      { scope: "source.css selector bar", settings: { fontStyle: "bold" } },
      {
        scope: "constant",
        settings: { fontStyle: "italic", foreground: "#ff0000" },
      },
      { scope: "constant.numeric", settings: { foreground: "#00ff00" } },
      { scope: "constant.numeric.hex", settings: { fontStyle: "bold" } },
      {
        scope: "constant.numeric.oct",
        settings: { fontStyle: "bold italic underline" },
      },
      {
        scope: "constant.numeric.bin",
        settings: { fontStyle: "bold strikethrough" },
      },
      {
        scope: "constant.numeric.dec",
        settings: { fontStyle: "", foreground: "#0000ff" },
      },
      { scope: "foo", settings: { fontStyle: "", foreground: "#CFA" } },
    ],
  });

  const expected = [
    new ParsedThemeRule("", null, 0, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("source", null, 1, FontStyle.NotSet, null, "#100000"),
    new ParsedThemeRule(
      "something",
      null,
      1,
      FontStyle.NotSet,
      null,
      "#100000",
    ),
    new ParsedThemeRule("bar", null, 2, FontStyle.NotSet, null, "#010000"),
    new ParsedThemeRule("baz", null, 2, FontStyle.NotSet, null, "#010000"),
    new ParsedThemeRule(
      "bar",
      ["selector", "source.css"],
      3,
      FontStyle.Bold,
      null,
      null,
    ),
    new ParsedThemeRule("constant", null, 4, FontStyle.Italic, "#ff0000", null),
    new ParsedThemeRule(
      "constant.numeric",
      null,
      5,
      FontStyle.NotSet,
      "#00ff00",
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.hex",
      null,
      6,
      FontStyle.Bold,
      null,
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.oct",
      null,
      7,
      FontStyle.Bold | FontStyle.Italic | FontStyle.Underline,
      null,
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.bin",
      null,
      8,
      FontStyle.Bold | FontStyle.Strikethrough,
      null,
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.dec",
      null,
      9,
      FontStyle.None,
      "#0000ff",
      null,
    ),
    new ParsedThemeRule("foo", null, 10, FontStyle.None, "#CFA", null),
  ];

  assert.deepStrictEqual(actual, expected);
});

Deno.test("Theme resolving strcmp works", () => {
  const actual = ["bar", "z", "zu", "a", "ab", ""].sort(strcmp);
  const expected = ["", "a", "ab", "bar", "z", "zu"];
  assert.deepStrictEqual(actual, expected);
});

Deno.test("Theme resolving strArrCmp works", () => {
  function assertStrArrCmp(
    testCase: string,
    a: string[] | null,
    b: string[] | null,
    expected: number,
  ): void {
    assert.strictEqual(strArrCmp(a, b), expected, testCase);
  }
  assertStrArrCmp("001", null, null, 0);
  assertStrArrCmp("002", null, [], -1);
  assertStrArrCmp("003", null, ["a"], -1);
  assertStrArrCmp("004", [], null, 1);
  assertStrArrCmp("005", ["a"], null, 1);
  assertStrArrCmp("006", [], [], 0);
  assertStrArrCmp("007", [], ["a"], -1);
  assertStrArrCmp("008", ["a"], [], 1);
  assertStrArrCmp("009", ["a"], ["a"], 0);
  assertStrArrCmp("010", ["a", "b"], ["a"], 1);
  assertStrArrCmp("011", ["a"], ["a", "b"], -1);
  assertStrArrCmp("012", ["a", "b"], ["a", "b"], 0);
  assertStrArrCmp("013", ["a", "b"], ["a", "c"], -1);
  assertStrArrCmp("014", ["a", "c"], ["a", "b"], 1);
});

function assertThemeEqual(actual: Theme, expected: Theme): void {
  // Don't compare cache objects
  assert.deepStrictEqual(
    [actual["_colorMap"], actual["_defaults"], actual["_root"]],
    [expected["_colorMap"], actual["_defaults"], actual["_root"]],
  );
}

Deno.test("Theme resolving always has defaults", () => {
  const actual = Theme.createFromParsedTheme([]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#000000");
  const _B = colorMap.getId("#ffffff");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving respects incoming defaults 1", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, null, null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#000000");
  const _B = colorMap.getId("#ffffff");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving respects incoming defaults 2", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.None, null, null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#000000");
  const _B = colorMap.getId("#ffffff");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving respects incoming defaults 3", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.Bold, null, null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#000000");
  const _B = colorMap.getId("#ffffff");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.Bold, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving respects incoming defaults 4", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#ff0000", null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#ff0000");
  const _B = colorMap.getId("#ffffff");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving respects incoming defaults 5", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, null, "#ff0000"),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#000000");
  const _B = colorMap.getId("#ff0000");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving can merge incoming defaults", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, null, "#ff0000"),
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#00ff00", null),
    new ParsedThemeRule("", null, -1, FontStyle.Bold, null, null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#00ff00");
  const _B = colorMap.getId("#ff0000");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.Bold, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving defaults are inherited", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("var", null, -1, FontStyle.NotSet, "#ff0000", null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#F8F8F2");
  const _B = colorMap.getId("#272822");
  const _C = colorMap.getId("#ff0000");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
      [],
      {
        "var": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.NotSet, _C, _NOT_SET),
        ),
      },
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving same rules get merged", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("var", null, 1, FontStyle.Bold, null, null),
    new ParsedThemeRule("var", null, 0, FontStyle.NotSet, "#ff0000", null),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#F8F8F2");
  const _B = colorMap.getId("#272822");
  const _C = colorMap.getId("#ff0000");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
      [],
      {
        "var": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.Bold, _C, _NOT_SET),
        ),
      },
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving rules are inherited 1", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("var", null, -1, FontStyle.Bold, "#ff0000", null),
    new ParsedThemeRule(
      "var.identifier",
      null,
      -1,
      FontStyle.NotSet,
      "#00ff00",
      null,
    ),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#F8F8F2");
  const _B = colorMap.getId("#272822");
  const _C = colorMap.getId("#ff0000");
  const _D = colorMap.getId("#00ff00");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
      [],
      {
        "var": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.Bold, _C, _NOT_SET),
          [],
          {
            "identifier": new ThemeTrieElement(
              new ThemeTrieElementRule(2, null, FontStyle.Bold, _D, _NOT_SET),
            ),
          },
        ),
      },
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving rules are inherited 2", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("var", null, -1, FontStyle.Bold, "#ff0000", null),
    new ParsedThemeRule(
      "var.identifier",
      null,
      -1,
      FontStyle.NotSet,
      "#00ff00",
      null,
    ),
    new ParsedThemeRule("constant", null, 4, FontStyle.Italic, "#100000", null),
    new ParsedThemeRule(
      "constant.numeric",
      null,
      5,
      FontStyle.NotSet,
      "#200000",
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.hex",
      null,
      6,
      FontStyle.Bold,
      null,
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.oct",
      null,
      7,
      FontStyle.Bold | FontStyle.Italic | FontStyle.Underline,
      null,
      null,
    ),
    new ParsedThemeRule(
      "constant.numeric.dec",
      null,
      8,
      FontStyle.None,
      "#300000",
      null,
    ),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#F8F8F2");
  const _B = colorMap.getId("#272822");
  const _C = colorMap.getId("#100000");
  const _D = colorMap.getId("#200000");
  const _E = colorMap.getId("#300000");
  const _F = colorMap.getId("#ff0000");
  const _G = colorMap.getId("#00ff00");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
      [],
      {
        "var": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.Bold, _F, _NOT_SET),
          [],
          {
            "identifier": new ThemeTrieElement(
              new ThemeTrieElementRule(2, null, FontStyle.Bold, _G, _NOT_SET),
            ),
          },
        ),
        "constant": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.Italic, _C, _NOT_SET),
          [],
          {
            "numeric": new ThemeTrieElement(
              new ThemeTrieElementRule(2, null, FontStyle.Italic, _D, _NOT_SET),
              [],
              {
                "hex": new ThemeTrieElement(
                  new ThemeTrieElementRule(
                    3,
                    null,
                    FontStyle.Bold,
                    _D,
                    _NOT_SET,
                  ),
                ),
                "oct": new ThemeTrieElement(
                  new ThemeTrieElementRule(
                    3,
                    null,
                    FontStyle.Bold | FontStyle.Italic | FontStyle.Underline,
                    _D,
                    _NOT_SET,
                  ),
                ),
                "dec": new ThemeTrieElement(
                  new ThemeTrieElementRule(
                    3,
                    null,
                    FontStyle.None,
                    _E,
                    _NOT_SET,
                  ),
                ),
              },
            ),
          },
        ),
      },
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving rules with parent scopes", () => {
  const actual = Theme.createFromParsedTheme([
    new ParsedThemeRule("", null, -1, FontStyle.NotSet, "#F8F8F2", "#272822"),
    new ParsedThemeRule("var", null, -1, FontStyle.Bold, "#100000", null),
    new ParsedThemeRule(
      "var.identifier",
      null,
      -1,
      FontStyle.NotSet,
      "#200000",
      null,
    ),
    new ParsedThemeRule(
      "var",
      ["source.css"],
      1,
      FontStyle.Italic,
      "#300000",
      null,
    ),
    new ParsedThemeRule(
      "var",
      ["source.css"],
      2,
      FontStyle.Underline,
      null,
      null,
    ),
  ]);
  const colorMap = new ColorMap();
  const _NOT_SET = 0;
  const _A = colorMap.getId("#F8F8F2");
  const _B = colorMap.getId("#272822");
  const _C = colorMap.getId("#100000");
  const _D = colorMap.getId("#300000");
  const _E = colorMap.getId("#200000");
  const expected = new Theme(
    colorMap,
    new StyleAttributes(FontStyle.None, _A, _B),
    new ThemeTrieElement(
      new ThemeTrieElementRule(0, null, FontStyle.NotSet, _NOT_SET, _NOT_SET),
      [],
      {
        "var": new ThemeTrieElement(
          new ThemeTrieElementRule(1, null, FontStyle.Bold, _C, 0),
          [
            new ThemeTrieElementRule(
              1,
              ["source.css"],
              FontStyle.Underline,
              _D,
              _NOT_SET,
            ),
          ],
          {
            "identifier": new ThemeTrieElement(
              new ThemeTrieElementRule(2, null, FontStyle.Bold, _E, _NOT_SET),
              [
                new ThemeTrieElementRule(
                  1,
                  ["source.css"],
                  FontStyle.Underline,
                  _D,
                  _NOT_SET,
                ),
              ],
            ),
          },
        ),
      },
    ),
  );
  assertThemeEqual(actual, expected);
});

Deno.test("Theme resolving issue #38: ignores rules with invalid colors", () => {
  const actual = parseTheme({
    settings: [{
      settings: {
        background: "#222222",
        foreground: "#cccccc",
      },
    }, {
      name: "Variable",
      scope: "variable",
      settings: {
        fontStyle: "",
      },
    }, {
      name: "Function argument",
      scope: "variable.parameter",
      settings: {
        fontStyle: "italic",
        foreground: "",
      },
    }, {
      name: "Library variable",
      scope: "support.other.variable",
      settings: {
        fontStyle: "",
      },
    }, {
      name: "Function argument",
      scope: "variable.other",
      settings: {
        foreground: "",
        fontStyle: "normal",
      },
    }, {
      name: "Coffeescript Function argument",
      scope: "variable.parameter.function.coffee",
      settings: {
        foreground: "#F9D423",
        fontStyle: "italic",
      },
    }],
  });

  const expected = [
    new ParsedThemeRule("", null, 0, FontStyle.NotSet, "#cccccc", "#222222"),
    new ParsedThemeRule("variable", null, 1, FontStyle.None, null, null),
    new ParsedThemeRule(
      "variable.parameter",
      null,
      2,
      FontStyle.Italic,
      null,
      null,
    ),
    new ParsedThemeRule(
      "support.other.variable",
      null,
      3,
      FontStyle.None,
      null,
      null,
    ),
    new ParsedThemeRule("variable.other", null, 4, FontStyle.None, null, null),
    new ParsedThemeRule(
      "variable.parameter.function.coffee",
      null,
      5,
      FontStyle.Italic,
      "#F9D423",
      null,
    ),
  ];

  assert.deepStrictEqual(actual, expected);
});

Deno.test("Theme resolving issue #35: Trailing comma in a tmTheme scope selector", () => {
  const actual = parseTheme({
    settings: [{
      settings: {
        background: "#25292C",
        foreground: "#EFEFEF",
      },
    }, {
      name: "CSS at-rule keyword control",
      scope: [
        "meta.at-rule.return.scss,",
        "meta.at-rule.return.scss punctuation.definition,",
        "meta.at-rule.else.scss,",
        "meta.at-rule.else.scss punctuation.definition,",
        "meta.at-rule.if.scss,",
        "meta.at-rule.if.scss punctuation.definition,",
      ].join("\n"),
      settings: {
        foreground: "#CC7832",
      },
    }],
  });

  const expected = [
    new ParsedThemeRule("", null, 0, FontStyle.NotSet, "#EFEFEF", "#25292C"),
    new ParsedThemeRule(
      "meta.at-rule.return.scss",
      null,
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
    new ParsedThemeRule(
      "punctuation.definition",
      ["meta.at-rule.return.scss"],
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
    new ParsedThemeRule(
      "meta.at-rule.else.scss",
      null,
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
    new ParsedThemeRule(
      "punctuation.definition",
      ["meta.at-rule.else.scss"],
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
    new ParsedThemeRule(
      "meta.at-rule.if.scss",
      null,
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
    new ParsedThemeRule(
      "punctuation.definition",
      ["meta.at-rule.if.scss"],
      1,
      FontStyle.NotSet,
      "#CC7832",
      null,
    ),
  ];

  assert.deepStrictEqual(actual, expected);
});
