/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { createMatchers } from "../matcher.ts";
import { assertEquals } from "./deps.ts";

const tests = [
  { "expression": "foo", "input": ["foo"], "result": true },
  { "expression": "foo", "input": ["bar"], "result": false },
  { "expression": "- foo", "input": ["foo"], "result": false },
  { "expression": "- foo", "input": ["bar"], "result": true },
  { "expression": "- - foo", "input": ["bar"], "result": false },
  { "expression": "bar foo", "input": ["foo"], "result": false },
  { "expression": "bar foo", "input": ["bar"], "result": false },
  { "expression": "bar foo", "input": ["bar", "foo"], "result": true },
  { "expression": "bar - foo", "input": ["bar"], "result": true },
  { "expression": "bar - foo", "input": ["foo", "bar"], "result": false },
  { "expression": "bar - foo", "input": ["foo"], "result": false },
  { "expression": "bar, foo", "input": ["foo"], "result": true },
  { "expression": "bar, foo", "input": ["bar"], "result": true },
  { "expression": "bar, foo", "input": ["bar", "foo"], "result": true },
  { "expression": "bar, -foo", "input": ["bar", "foo"], "result": true },
  { "expression": "bar, -foo", "input": ["yo"], "result": true },
  { "expression": "bar, -foo", "input": ["foo"], "result": false },
  { "expression": "(foo)", "input": ["foo"], "result": true },
  { "expression": "(foo - bar)", "input": ["foo"], "result": true },
  { "expression": "(foo - bar)", "input": ["foo", "bar"], "result": false },
  {
    "expression": "foo bar - (yo man)",
    "input": ["foo", "bar"],
    "result": true,
  },
  {
    "expression": "foo bar - (yo man)",
    "input": ["foo", "bar", "yo"],
    "result": true,
  },
  {
    "expression": "foo bar - (yo man)",
    "input": ["foo", "bar", "yo", "man"],
    "result": false,
  },
  {
    "expression": "foo bar - (yo | man)",
    "input": ["foo", "bar", "yo", "man"],
    "result": false,
  },
  {
    "expression": "foo bar - (yo | man)",
    "input": ["foo", "bar", "yo"],
    "result": false,
  },
  {
    "expression": "R:text.html - (comment.block, text.html source)",
    "input": ["text.html", "bar", "source"],
    "result": false,
  },
  {
    "expression":
      "text.html.php - (meta.embedded | meta.tag), L:text.html.php meta.tag, L:source.js.embedded.html",
    "input": ["text.html.php", "bar", "source.js"],
    "result": true,
  },
];

const nameMatcher = (identifers: string[], stackElements: string[]) => {
  let lastIndex = 0;
  return identifers.every((identifier) => {
    for (let i = lastIndex; i < stackElements.length; i++) {
      if (stackElements[i] === identifier) {
        lastIndex = i + 1;
        return true;
      }
    }
    return false;
  });
};

tests.forEach((test, index) => {
  Deno.test("Matcher Test #" + index, () => {
    const matchers = createMatchers(test.expression, nameMatcher);
    const result = matchers.some((m) => m.matcher(test.input));
    assertEquals(result, test.result);
  });
});
