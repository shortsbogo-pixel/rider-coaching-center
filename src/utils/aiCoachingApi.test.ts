import assert from "node:assert/strict";
import test from "node:test";
import { buildAICoachingApiHeaders, buildAICoachingApiUrl } from "./aiCoachingApi";

test("AI coaching API URL uses the Vite proxy path by default", () => {
  assert.equal(buildAICoachingApiUrl("/status", ""), "/api/ai-coaching/status");
});

test("AI coaching API URL can target an explicit backend origin", () => {
  assert.equal(buildAICoachingApiUrl("status", "http://localhost:4110/"), "http://localhost:4110/api/ai-coaching/status");
});

test("AI coaching API headers preserve the admin auth header", () => {
  assert.deepEqual(buildAICoachingApiHeaders({ "x-user-role": "admin", "x-user-id": "admin" }), {
    "x-user-role": "admin",
    "x-user-id": "admin"
  });
});
