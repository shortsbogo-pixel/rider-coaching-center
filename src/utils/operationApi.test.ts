import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationApiUrl } from "./operationApi";

test("operation API URL uses the existing Vite proxy path by default", () => {
  assert.equal(buildOperationApiUrl("/logs", ""), "/api/operation/logs");
});

test("operation API URL can target an explicit backend origin", () => {
  assert.equal(buildOperationApiUrl("/logs", "http://localhost:4100/"), "http://localhost:4100/api/operation/logs");
});
