// deno-lint-ignore-file no-explicit-any
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { IOnigLib } from "../types.ts";
import { fromFileUrl, join } from "./deps.ts";

let onigurumaLib: Promise<IOnigLib> | null = null;

export async function getOniguruma(): Promise<IOnigLib> {
  if (!onigurumaLib) {
    const vscodeOnigurumaModule = await import(
      "https://esm.sh/vscode-oniguruma@1.5.1"
    );
    const wasmBin = Deno.readFileSync(
      join(fromFileUrl(import.meta.url), "../onig.wasm"),
    ).buffer;
    onigurumaLib = (<Promise<any>> vscodeOnigurumaModule.loadWASM(wasmBin))
      .then((_: any) => {
        return {
          createOnigScanner(patterns: string[]) {
            return new vscodeOnigurumaModule.OnigScanner(patterns);
          },
          createOnigString(s: string) {
            return new vscodeOnigurumaModule.OnigString(s);
          },
        };
      });
  }
  return onigurumaLib;
}
