import { describe, expect, it } from "vitest";
import { reconcile } from "../src/sync/reconcile";
import type { LocalEntry, RemoteEntry } from "../src/sync/types";

const B = "t1";
const newer = "t2";
const newest = "t3";

const local = (updatedAt: string, id = "g"): LocalEntry => ({ id, updatedAt, turnCount: 1 });
const remote = (updatedAt: string, deleted = false, id = "g"): RemoteEntry => ({
  id,
  updatedAt,
  turnCount: 1,
  deleted,
});

describe("reconcile", () => {
  it("uploads a game that exists only locally", () => {
    expect(reconcile([local(B)], [], {})).toEqual([{ type: "upload", id: "g" }]);
  });
  it("downloads a game that exists only remotely", () => {
    expect(reconcile([], [remote(B)], {})).toEqual([{ type: "download", id: "g" }]);
  });
  it("uploads when local changed and remote is at the base", () => {
    expect(reconcile([local(newer)], [remote(B)], { g: B })).toEqual([{ type: "upload", id: "g" }]);
  });
  it("downloads when remote changed and local is at the base", () => {
    expect(reconcile([local(B)], [remote(newer)], { g: B })).toEqual([{ type: "download", id: "g" }]);
  });
  it("reports a both_changed conflict when both sides moved", () => {
    expect(reconcile([local(newer)], [remote(newest)], { g: B })).toEqual([
      { type: "conflict", id: "g", kind: "both_changed" },
    ]);
  });
  it("deletes locally when remote is a tombstone and local is at the base", () => {
    expect(reconcile([local(B)], [remote(newer, true)], { g: B })).toEqual([
      { type: "delete_local", id: "g" },
      { type: "forget_base", id: "g" },
    ]);
  });
  it("reports a deleted_remotely conflict when remote is a tombstone and local changed", () => {
    expect(reconcile([local(newer)], [remote(newest, true)], { g: B })).toEqual([
      { type: "conflict", id: "g", kind: "deleted_remotely" },
    ]);
  });
  it("writes a tombstone when local is missing, base exists and remote is at the base", () => {
    expect(reconcile([], [remote(B)], { g: B })).toEqual([{ type: "tombstone", id: "g" }]);
  });
  it("downloads when local is missing, base exists and remote changed", () => {
    expect(reconcile([], [remote(newer)], { g: B })).toEqual([{ type: "download", id: "g" }]);
  });
  it("forgets the base when local is missing, base exists and remote is a tombstone", () => {
    expect(reconcile([], [remote(newer, true)], { g: B })).toEqual([{ type: "forget_base", id: "g" }]);
  });
  it("uploads when local is at the base and remote is missing entirely", () => {
    expect(reconcile([local(B)], [], { g: B })).toEqual([{ type: "upload", id: "g" }]);
  });
  it("marks as synced when both sides have the same updatedAt", () => {
    expect(reconcile([local(newer)], [remote(newer)], { g: B })).toEqual([
      { type: "mark_synced", id: "g", updatedAt: newer },
    ]);
  });
  it("uploads the newer local on first connection (no base)", () => {
    expect(reconcile([local(newer)], [remote(B)], {})).toEqual([{ type: "upload", id: "g" }]);
  });
  it("downloads the newer remote on first connection (no base)", () => {
    expect(reconcile([local(B)], [remote(newer)], {})).toEqual([{ type: "download", id: "g" }]);
  });
  it("reports deleted_remotely when there is no base, remote is a tombstone and local exists", () => {
    expect(reconcile([local(B)], [remote(newer, true)], {})).toEqual([
      { type: "conflict", id: "g", kind: "deleted_remotely" },
    ]);
  });
  it("does nothing for a tombstone with no local game and no base", () => {
    expect(reconcile([], [remote(B, true)], {})).toEqual([]);
  });
  it("orders output by local ids first, then remaining remote ids", () => {
    const actions = reconcile(
      [local(B, "a"), local(B, "b")],
      [remote(B, false, "c"), remote(B, false, "a")],
      {},
    );
    expect(actions.map((a) => `${a.type}:${a.id}`)).toEqual(["mark_synced:a", "upload:b", "download:c"]);
  });
});
