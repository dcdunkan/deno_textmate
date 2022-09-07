/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export const DebugFlags = {
  InDebugMode: !!Deno.env.get("VSCODE_TEXTMATE_DEBUG"),
};

export const UseOnigurumaFindOptions = false;
