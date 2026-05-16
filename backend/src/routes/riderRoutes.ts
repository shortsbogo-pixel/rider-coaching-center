import { Router } from "express";
import { getRiderMetrics } from "../services/analysisService";

const router = Router();

function getHeaderRiderId(raw?: string) {
  return raw ? decodeURIComponent(raw) : "";
}

router.get("/", async (req, res, next) => {
  try {
    if (req.header("x-user-role") !== "admin" && req.header("x-user-role") !== "rider") {
      res.status(401).json({ message: "로그인이 필요합니다." });
      return;
    }
    if (req.header("x-user-role") === "rider") {
      res.status(403).json({ message: "관리자는 전체 라이더 조회가 가능하고, 라이더는 본인 데이터만 조회할 수 있습니다." });
      return;
    }
    res.json(await getRiderMetrics());
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
    if (req.header("x-user-role") === "rider" && getHeaderRiderId(req.header("x-rider-id")) !== req.params.id) {
      res.status(403).json({ message: "본인 라이더 데이터만 조회할 수 있습니다." });
      return;
    }
    const rider = (await getRiderMetrics()).find((item) => item.riderId === req.params.id);
    if (!rider) {
      res.status(404).json({ message: "Rider not found" });
      return;
    }
    res.json(rider);
  } catch (error) {
    next(error);
  }
});

export default router;
