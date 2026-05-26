import cors from "cors";
import express from "express";
import adminNoteRoutes from "./routes/adminNoteRoutes";
import aiCoachingRoutes from "./routes/aiCoachingRoutes";
import coachingRoutes from "./routes/coachingRoutes";
import coachingMessageRoutes from "./routes/coachingMessageRoutes";
import dataManagementRoutes from "./routes/dataManagementRoutes";
import operationDataRoutes from "./routes/operationDataRoutes";
import riderRoutes from "./routes/riderRoutes";
import uploadRoutes from "./routes/uploadRoutes";

const app = express();
const port = Number(process.env.PORT ?? 4100);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "rider-coaching-center" });
});

app.use("/api/uploads", uploadRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/coaching", coachingRoutes);
app.use("/api/admin-notes", adminNoteRoutes);
app.use("/api/custom-coaching", coachingMessageRoutes);
app.use("/api/ai-coaching", aiCoachingRoutes);
app.use("/api/data-management", dataManagementRoutes);
app.use("/api/operation", operationDataRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ message: error.message || "요청을 처리할 수 없습니다." });
});

app.listen(port, () => {
  console.log(`Rider coaching API listening on http://localhost:${port}`);
});
