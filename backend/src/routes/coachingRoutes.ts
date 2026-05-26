import { Router } from "express";
import { getCoachingMessages } from "../services/coachingService";

const router = Router();

function getRequestedWeekKey(raw: unknown) {
  const weekKey = typeof raw === "string" ? raw.trim() : "";
  return weekKey || undefined;
}

router.get("/", async (_req, res, next) => {
  try {
    if (_req.header("x-user-role") !== "admin" && _req.header("x-user-role") !== "rider") {
      res.status(401).json({ message: "로그인이 필요합니다." });
      return;
    }
    const payload = await getCoachingMessages(getRequestedWeekKey(_req.query.weekKey));
    if (_req.header("x-user-role") === "rider") {
      const riderId = decodeURIComponent(_req.header("x-rider-id") || "");
      res.json({ ...payload, messages: payload.messages.filter((message) => message.riderId === riderId) });
      return;
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (req.header("x-user-role") !== "admin" && req.header("x-user-role") !== "rider") {
      res.status(401).json({ message: "로그인이 필요합니다." });
      return;
    }
    if (req.header("x-user-role") === "rider" && decodeURIComponent(req.header("x-rider-id") || "") !== req.params.id) {
      res.status(403).json({ message: "본인 코칭 메시지만 조회할 수 있습니다." });
      return;
    }
    const payload = await getCoachingMessages(getRequestedWeekKey(req.query.weekKey));
    const coaching = payload.messages.find((item) => item.riderId === req.params.id);
    if (!coaching) {
      res.status(404).json({ message: "Coaching message not found" });
      return;
    }
    res.json(coaching);
  } catch (error) {
    next(error);
  }
});

export default router;
