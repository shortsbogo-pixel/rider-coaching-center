import type { AdminNote } from "../../../src/types/adminNote";
import { createJsonRepository } from "./storageClient";

const repository = createJsonRepository<AdminNote & { id: string }>("adminNotes.json");

function noteId(riderId: string, weekKey: string) {
  return `${weekKey}::${riderId}`;
}

export const adminNoteRepository = {
  ...repository,
  idFor: noteId,
  async getByRiderWeek(riderId: string, weekKey: string) {
    return repository.getById(noteId(riderId, weekKey));
  },
  async saveForRiderWeek(note: AdminNote) {
    return repository.save({ ...note, id: note.id ?? noteId(note.riderId, note.weekKey) });
  },
  async removeByRiderWeek(riderId: string, weekKey: string) {
    await repository.remove(noteId(riderId, weekKey));
  }
};
