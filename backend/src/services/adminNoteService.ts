import { resolve } from "node:path";
import type { AdminNote } from "../../../src/types/adminNote";
import { readJsonArray, writeJsonArray } from "./jsonStore";

const adminNotesPath = resolve(process.cwd(), "backend/src/data/adminNotes.json");

function matchesKey(note: AdminNote, riderId: string, weekKey: string) {
  return note.riderId === riderId && note.weekKey === weekKey;
}

export async function getAdminNotes(weekKey?: string) {
  const notes = await readJsonArray<AdminNote>(adminNotesPath);
  return weekKey ? notes.filter((note) => note.weekKey === weekKey) : notes;
}

export async function getAdminNote(riderId: string, weekKey: string) {
  const notes = await readJsonArray<AdminNote>(adminNotesPath);
  return notes.find((note) => matchesKey(note, riderId, weekKey));
}

export async function saveAdminNote(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  note: string;
  updatedBy?: string;
}) {
  const notes = await readJsonArray<AdminNote>(adminNotesPath);
  const nextNote: AdminNote = {
    riderId: input.riderId,
    riderName: input.riderName,
    weekKey: input.weekKey,
    note: input.note,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy || "admin"
  };

  const next = notes.filter((note) => !matchesKey(note, input.riderId, input.weekKey));
  if (input.note.trim()) {
    next.push(nextNote);
  }
  await writeJsonArray(adminNotesPath, next);
  return nextNote;
}

export async function deleteAdminNote(riderId: string, weekKey: string) {
  const notes = await readJsonArray<AdminNote>(adminNotesPath);
  await writeJsonArray(
    adminNotesPath,
    notes.filter((note) => !matchesKey(note, riderId, weekKey))
  );
}
