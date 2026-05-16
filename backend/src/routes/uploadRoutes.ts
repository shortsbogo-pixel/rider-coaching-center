import { Router } from "express";
import multer from "multer";
import { getUploadedWeeks, getValidationSummary, receiveUploadPreview, saveUploadedExcel } from "../services/excelService";

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
