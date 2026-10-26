import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

function section(name) {
  return config.split(`[${name}]`)[1]?.split(/^\[/m)[0] ?? "";
}

test("local Supabase Auth bounds signup and recovery requests", () => {
  assert.match(section("auth.rate_limit"), /^sign_in_sign_ups = 10$/m);
  assert.match(section("auth.email"), /^max_frequency = "60s"$/m);
  assert.match(section("auth.email"), /^enable_confirmations = true$/m);
});

test("auth templates retain the Supabase confirmation link and Untiered identity", () => {
  for (const kind of ["confirmation", "recovery", "email_change"]) {
    assert.match(section(`auth.email.template.${kind}`), new RegExp(`content_path = "\\./supabase/templates/${kind}\\.html"`));
    const template = readFileSync(new URL(`../supabase/templates/${kind}.html`, import.meta.url), "utf8");
    assert.match(template, /<meta name="viewport"/);
    assert.match(template, /UNTIERED/);
    assert.match(template, /help@untiered\.tech/);
    assert.equal(template.match(/\{\{ \.ConfirmationURL \}\}/g)?.length, 1);
    assert.doesNotMatch(template, /<script\b/i);
  }
});
