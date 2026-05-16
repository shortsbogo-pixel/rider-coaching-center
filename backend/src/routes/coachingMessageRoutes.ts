import { Router } from "express";
import type { Request, Response } from "express";
import {
  getCustomCoachingMessage,
  getCustomCoachingMessages,
  resetCustomCoachingMessage,
  saveCustomCoachingMessage
} from "../services/coachingMessageService";

const router = Router();

function requireAdmin(req: Request, res: Response) {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return false;
  }
  return true;
}

router.get("/", async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    res.json(await getCustomCoachingMessages(req.query.weekKey?.toString()));
  } catch (error) {
    next(error);
  }
});

router.get("/:riderId", async (req, res, next) => {
  try {
    if (req.header("x-user-role") === "rider" && decodeURIComponent(req.header("x-rider-id") || "") !== req.params.riderId) {
      res.status(403).json({ message: "본인 코칭 메시지만 조회할 수 있습니다." });
      return;
    }
    const weekKey = req.query.weekKey?.toString() || "";
    const message = await getCustomCoachingMessage(req.params.riderId, weekKey);
    res.json(message ?? null);
  } catch (error) {
    next(error);
  }
});

router.put("/:riderId", async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const message = await saveCustomCoachingMessage({
      riderId: req.params.riderId,
      riderName: req.body.riderName,
      weekKey: req.body.weekKey,
      autoMessage: req.body.autoMessage,
      customMessage: req.body.customMessage,
      updatedBy: req.body.updatedBy
    });
    res.json(message);
  } catch (error) {
    next(error);
  }
});

router.delete("/:riderId", async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const weekKey = req.query.weekKey?.toString() || "";
    await resetCustomCoachingMessage(req.params.riderId, weekKey);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
