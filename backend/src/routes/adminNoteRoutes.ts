import { Router } from "express";
import { deleteAdminNote, getAdminNote, getAdminNotes, saveAdminNote } from "../services/adminNoteService";

const router = Router();

router.use((req, res, next) => {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await getAdminNotes(req.query.weekKey?.toString()));
  } catch (error) {
    next(error);
  }
});

router.get("/:riderId", async (req, res, next) => {
  try {
    const weekKey = req.query.weekKey?.toString() || "";
    const note = await getAdminNote(req.params.riderId, weekKey);
    res.json(note ?? null);
  } catch (error) {
    next(error);
  }
});

router.put("/:riderId", async (req, res, next) => {
  try {
    const note = await saveAdminNote({
      riderId: req.params.riderId,
      riderName: req.body.riderName,
      weekKey: req.body.weekKey,
      note: req.body.note ?? "",
      updatedBy: req.body.updatedBy
    });
    res.json(note);
  } catch (error) {
    next(error);
  }
});

router.delete("/:riderId", async (req, res, next) => {
  try {
    const weekKey = req.query.weekKey?.toString() || "";
    await deleteAdminNote(req.params.riderId, weekKey);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
