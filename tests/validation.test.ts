import { test } from "node:test";
import assert from "node:assert/strict";
import { applicationInput } from "../src/features/applications/validation";
const base = {
  company: " Example ",
  title: "Engineer",
  location: "",
  workMode: "REMOTE",
  stage: "APPLIED",
  url: "https://example.com/job",
  notes: "",
  appliedAt: "2026-01-10",
  firstResponseAt: "",
};
test("submission date is required outside Wishlist", () => {
  assert.equal(
    applicationInput.safeParse({ ...base, appliedAt: "" }).success,
    false,
  );
  assert.equal(
    applicationInput.safeParse({ ...base, stage: "WISHLIST", appliedAt: "" })
      .success,
    true,
  );
});
test("rejects impossible dates and responses before submission", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-00-10"])
    assert.equal(
      applicationInput.safeParse({ ...base, appliedAt: date }).success,
      false,
    );
  assert.equal(
    applicationInput.safeParse({ ...base, firstResponseAt: "2026-01-09" })
      .success,
    false,
  );
});
test("a future response is not valid history", () => {
  assert.equal(
    applicationInput.safeParse({ ...base, firstResponseAt: "2099-01-01" })
      .success,
    false,
  );
});
test("rejects active script URLs and oversized notes", () => {
  assert.equal(
    applicationInput.safeParse({ ...base, url: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    applicationInput.safeParse({ ...base, notes: "x".repeat(10001) }).success,
    false,
  );
});
test("interview and offer dates require evidence of a response", () => {
  for (const stage of ["SCREENING", "TECHNICAL", "OFFER"]) {
    assert.equal(applicationInput.safeParse({ ...base, stage }).success, false);
    assert.equal(
      applicationInput.safeParse({
        ...base,
        stage,
        firstResponseAt: "2026-01-11",
      }).success,
      true,
    );
  }
});
test("ownership and archive metadata cannot enter through editable fields", () => {
  const parsed = applicationInput.parse({
    ...base,
    userId: "attacker",
    version: 10,
    archivedAt: new Date(),
  });
  assert.equal("userId" in parsed, false);
  assert.equal("version" in parsed, false);
  assert.equal(parsed.company, "Example");
});
