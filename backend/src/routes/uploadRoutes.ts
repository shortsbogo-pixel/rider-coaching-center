import { Router } from "express";
import multer from "multer";
import { getUploadedWeeks, getValidationSummary, receiveUploadPreview, resetAnalysisCaches, resetParsedUploads, saveUploadedExcel } from "../services/excelService";

const router = Router();
const upload = multer({
  dest: "backend/src/data/uploads",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(xlsx|xls)$/i.test(file.originalname)) {
      cb(new Error("xlsx 또는 xls 파일만 업로드할 수 있습니다."));
      return;
    }
    cb(null, true);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    res.json({ weeks: await getUploadedWeeks() });
  } catch (error) {
    next(error);
  }
});

router.get("/validation", async (_req, res, next) => {
  try {
    res.json(await getValidationSummary());
  } catch (error) {
    next(error);
  }
});

router.post("/parsed/reset", async (req, res, next) => {
  try {
    if (req.header("x-user-role") !== "admin") {
      res.status(403).json({ message: "관리자 권한이 필요합니다." });
      return;
    }
    res.json(await resetParsedUploads());
  } catch (error) {
    next(error);
  }
});

router.post("/analysis-cache/reset", async (req, res, next) => {
  try {
    if (req.header("x-user-role") !== "admin") {
      res.status(403).json({ message: "관리자 권한이 필요합니다." });
      return;
    }
    res.json(await resetAnalysisCaches());
  } catch (error) {
    next(error);
  }
});

router.post("/preview", upload.single("file"), async (req, res, next) => {
  try {
    res.json(await receiveUploadPreview(req.file, String(req.body.week ?? "")));
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    res.status(201).json(await saveUploadedExcel(req.file, String(req.body.week ?? "")));
  } catch (error) {
    next(error);
  }
});

export default router;
