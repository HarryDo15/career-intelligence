import { test } from "node:test";
import assert from "node:assert/strict";
import { matchJob, mockListings } from "../src/lib/jobs";
import { profileInput } from "../src/features/discovery/validation";
const profile = profileInput.parse({
  name: "Engineering",
  titles: ["Engineer", "engineer"],
  keywords: ["react", "typescript"],
  excludedKeywords: ["intern"],
  locations: ["Singapore"],
  workModes: ["REMOTE"],
  enabled: true,
});
test("profiles normalize and deduplicate matching terms", () => {
  assert.deepEqual(profile.titles, ["engineer"]);
});
test("exclusions, location and arrangement act as hard filters", () => {
  assert.ok(matchJob(mockListings[0], profile));
  assert.equal(matchJob(mockListings[5], profile), null);
  assert.equal(matchJob(mockListings[1], profile), null);
  assert.equal(matchJob(mockListings[3], profile), null);
});
test("keyword score is bounded and explains actual matched terms", () => {
  const match = matchJob(mockListings[0], {
    ...profile,
    keywords: ["react", "rust"],
  });
  assert.equal(match?.score, 0.8);
  assert.ok(match?.reasons.includes("Keyword: react"));
  assert.ok(!match?.reasons.includes("Keyword: rust"));
  assert.equal(
    matchJob(mockListings[0], { ...profile, keywords: ["rust"] }),
    null,
  );
});
test("empty optional filters match any arrangement and location", () => {
  assert.ok(
    matchJob(mockListings[2], {
      ...profile,
      keywords: [],
      locations: [],
      workModes: [],
    }),
  );
});
