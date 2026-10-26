import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyError } from "../src/errors.ts";
import { friendlyError as appFriendlyError } from "../../src/lib/errors.ts";

const CREDIT = `400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CgLBHFGWiq8fXiC1NEdtV"}`;

test("the AI service's raw errors read as what they mean", () => {
  for (const f of [friendlyError, appFriendlyError]) {
    assert.equal(f(CREDIT), "Not enough credits.");
    assert.equal(f(`The scriptwriter couldn't finish: ${CREDIT}`), "Not enough credits.");
    assert.equal(f(`529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_1"}`), "The AI is busy right now. Try again in a few minutes.");
    assert.equal(f(`429 {"type":"error","error":{"type":"rate_limit_error","message":"Slow down"},"request_id":"req_1"}`), "Too many requests right now. Try again in a minute.");
    assert.equal(f(`Planning failed: 400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 250000 tokens"},"request_id":"req_1"}`), "Planning failed: prompt is too long: 250000 tokens");
    // A message cut short in the database still loses its JSON.
    assert.equal(f(`400 {"type":"error","error":{"type":"invalid_request_error","mess`), "The AI couldn't answer.");
    assert.equal(f("There's no footage on this video."), "There's no footage on this video.");
  }
  assert.equal(appFriendlyError(null), null);
});
