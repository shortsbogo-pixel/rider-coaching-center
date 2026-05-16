import { Router } from "express";
import { ensureAnalysisCache, exportAllData, exportDataSet, getDataManagementSummary, regenerateCaches } from "../services/dataManagementService";

const router = Router();

router.use((req, res, next) => {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
});

router.get("/summary", async (_req, res, next) => {
  try {
    await ensureAnalysisCache();
    res.json(await getDataManagementSummary());
  } catch (error) {
    next(error);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const type = req.query.type?.toString() ?? "all";
    res.json(type === "all" ? await exportAllData() : await exportDataSet(type));
  } catch (error) {
    next(error);
  }
});

router.post("/regenerate-caches", async (_req, res, next) => {
  try {
    res.json(await regenerateCaches());
  } catch (error) {
    next(error);
  }
});

export default router;
