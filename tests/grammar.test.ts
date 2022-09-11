/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { assertEquals as stdAssertEquals } from "./deps.ts";
import { StandardTokenType } from "../mod.ts";
import {
  StackElementMetadata,
  TemporaryStandardTokenType,
} from "../grammar.ts";
import { FontStyle } from "../theme.ts";

function assertEquals(
  metadata: number,
  languageId: number,
  tokenType: StandardTokenType,
  fontStyle: FontStyle,
  foreground: number,
  background: number,
): void {
  const actual = {
    languageId: StackElementMetadata.getLanguageId(metadata),
    tokenType: StackElementMetadata.getTokenType(metadata),
    fontStyle: StackElementMetadata.getFontStyle(metadata),
    foreground: StackElementMetadata.getForeground(metadata),
    background: StackElementMetadata.getBackground(metadata),
  };

  const expected = {
    languageId: languageId,
    tokenType: tokenType,
    fontStyle: fontStyle,
    foreground: foreground,
    background: background,
  };

  stdAssertEquals(
    actual,
    expected,
    "equals for " + StackElementMetadata.toBinaryStr(metadata),
  );
}

Deno.test("StackElementMetadata works", () => {
  const value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
});

Deno.test("StackElementMetadata can overwrite languageId", () => {
  let value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );

  value = StackElementMetadata.set(
    value,
    2,
    TemporaryStandardTokenType.Other,
    FontStyle.NotSet,
    0,
    0,
  );
  assertEquals(
    value,
    2,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
});

Deno.test("StackElementMetadata can overwrite tokenType", () => {
  let value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );

  value = StackElementMetadata.set(
    value,
    0,
    TemporaryStandardTokenType.Comment,
    FontStyle.NotSet,
    0,
    0,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.Comment,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
});

Deno.test("StackElementMetadata can overwrite font style", () => {
  let value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );

  value = StackElementMetadata.set(
    value,
    0,
    TemporaryStandardTokenType.Other,
    FontStyle.None,
    0,
    0,
  );
  assertEquals(value, 1, StandardTokenType.RegEx, FontStyle.None, 101, 102);
});

Deno.test(
  "StackElementMetadata can overwrite font style with strikethrough",
  () => {
    let value = StackElementMetadata.set(
      0,
      1,
      TemporaryStandardTokenType.RegEx,
      FontStyle.Strikethrough,
      101,
      102,
    );
    assertEquals(
      value,
      1,
      StandardTokenType.RegEx,
      FontStyle.Strikethrough,
      101,
      102,
    );

    value = StackElementMetadata.set(
      value,
      0,
      TemporaryStandardTokenType.Other,
      FontStyle.None,
      0,
      0,
    );
    assertEquals(
      value,
      1,
      StandardTokenType.RegEx,
      FontStyle.None,
      101,
      102,
    );
  },
);

Deno.test("StackElementMetadata can overwrite foreground", () => {
  let value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );

  value = StackElementMetadata.set(
    value,
    0,
    TemporaryStandardTokenType.Other,
    FontStyle.NotSet,
    5,
    0,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    5,
    102,
  );
});

Deno.test("StackElementMetadata can overwrite background", () => {
  let value = StackElementMetadata.set(
    0,
    1,
    TemporaryStandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    102,
  );

  value = StackElementMetadata.set(
    value,
    0,
    TemporaryStandardTokenType.Other,
    FontStyle.NotSet,
    0,
    7,
  );
  assertEquals(
    value,
    1,
    StandardTokenType.RegEx,
    FontStyle.Underline | FontStyle.Bold,
    101,
    7,
  );
});

Deno.test("StackElementMetadata can work at max values", () => {
  const maxLangId = 255;
  const maxTokenType = StandardTokenType.Comment | StandardTokenType.Other |
    StandardTokenType.RegEx | StandardTokenType.String;
  const maxFontStyle = FontStyle.Bold | FontStyle.Italic | FontStyle.Underline;
  const maxForeground = 511;
  const maxBackground = 511;

  const value = StackElementMetadata.set(
    0,
    maxLangId,
    maxTokenType,
    maxFontStyle,
    maxForeground,
    maxBackground,
  );
  assertEquals(
    value,
    maxLangId,
    maxTokenType,
    maxFontStyle,
    maxForeground,
    maxBackground,
  );
});
