import assert from "node:assert/strict";
import { test } from "node:test";
import { isOpenAt, minutesInZone } from "./business-hours.ts";

const TZ = "Asia/Bangkok"; // UTC+7, no DST

test("converts UTC to Bangkok minutes", () => {
  assert.equal(minutesInZone(new Date("2026-10-22T02:00:00Z"), TZ), 9 * 60);
});

test("open at 09:00 Bangkok, closed at 08:59", () => {
  assert.equal(isOpenAt(new Date("2026-10-22T02:00:00Z"), "09:00", "22:00", TZ), true);
  assert.equal(isOpenAt(new Date("2026-10-22T01:59:00Z"), "09:00", "22:00", TZ), false);
});

test("closed exactly at 22:00 Bangkok, open at 21:59", () => {
  assert.equal(isOpenAt(new Date("2026-10-22T15:00:00Z"), "09:00", "22:00", TZ), false);
  assert.equal(isOpenAt(new Date("2026-10-22T14:59:00Z"), "09:00", "22:00", TZ), true);
});

test("closed after midnight Bangkok", () => {
  assert.equal(isOpenAt(new Date("2026-10-22T18:00:00Z"), "09:00", "22:00", TZ), false);
});
