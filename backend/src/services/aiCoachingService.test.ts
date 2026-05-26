import assert from "node:assert/strict";
import test from "node:test";
import { buildOllamaGenerateRequestBody, buildOllamaStatusRequestBody } from "./aiCoachingService";

test("Ollama generate request uses default context and prediction options", () => {
  const body = buildOllamaGenerateRequestBody("test prompt");

  assert.equal(body.options.num_ctx, 1024);
  assert.equal(body.options.num_predict, 300);
});

test("Ollama status request uses the default context option", () => {
  const body = buildOllamaStatusRequestBody();

  assert.equal(body.options.num_ctx, 1024);
});
