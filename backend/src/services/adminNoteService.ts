import type { AdminNote } from "../../../src/types/adminNote";
import { adminNoteRepository } from "../repositories/adminNoteRepository";

export async function getAdminNotes(weekKey?: string) {
  const notes = await adminNoteRepository.getAll();
  return weekKey ? notes.filter((note) => note.weekKey === weekKey) : notes;
}

export async function getAdminNote(riderId: string, weekKey: string) {
  return adminNoteRepository.getByRiderWeek(riderId, weekKey);
}

export async function saveAdminNote(input: {
  riderId: string;
  riderName: string;
  weekKey: string;
  note: string;
  updatedBy?: string;
}) {
  const existing = await adminNoteRepository.getByRiderWeek(input.riderId, input.weekKey);
  const trimmedNote = input.note.trim();
  if (!trimmedNote) {
    await adminNoteRepository.removeByRiderWeek(input.riderId, input.weekKey);
  }

  const now = new Date().toISOString();
  const nextNote: AdminNote = {
    id: adminNoteRepository.idFor(input.riderId, input.weekKey),
    riderId: input.riderId,
    riderName: input.riderName,
    weekKey: input.weekKey,
    note: trimmedNote,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy: input.updatedBy || "admin"
  };

  if (trimmedNote) {
    await adminNoteRepository.saveForRiderWeek(nextNote);
  }
  return nextNote;
}

export async function deleteAdminNote(riderId: string, weekKey: string) {
  await adminNoteRepository.removeByRiderWeek(riderId, weekKey);
}
