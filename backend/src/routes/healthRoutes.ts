import { Router } from "express";
import { buildFullHealthReport, buildHealthSummary } from "../services/healthService";

const router = Router();
const startedAt = Date.now();
const version = process.env.npm_package_version ?? "0.1.0";

router.get("/", (_req, res) => {
  res.json(buildHealthSummary({ startedAt, version }));
});

router.get("/full", async (req, res, next) => {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ success: false, status: "fail", message: "관리자 권한이 필요합니다." });
    return;
  }

  try {
    res.json(await buildFullHealthReport({ startedAt, version }));
  } catch (error) {
    next(error);
  }
});

export default router;
