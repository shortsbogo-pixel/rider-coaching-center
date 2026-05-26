import { Router } from "express";
import type { Request, Response } from "express";
import { operationStorageService } from "../services/operationStorageService";
import type { OperationLogEntry, OperationStoredItem } from "../types/operationData";

const router = Router();

router.use((req, res, next) => {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ success: false, data: null, message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
});

function ok<T>(res: Response, data: T, message = "ok") {
  res.json({ success: true, data, message });
}

function fail(res: Response, error: unknown) {
  res.status(400).json({ success: false, data: null, message: error instanceof Error ? error.message : "operation request failed" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withId(value: unknown, prefix: string): OperationStoredItem {
  if (!isRecord(value)) return { id: randomId(prefix), value };
  return {
    ...value,
    id: typeof value.id === "string" && value.id.trim() ? value.id : randomId(prefix)
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function postCollection(collection: { save: (item: OperationStoredItem) => Promise<OperationStoredItem>; saveMany: (items: OperationStoredItem[]) => Promise<OperationStoredItem[]> }, prefix: string) {
  return async (req: Request, res: Response) => {
    try {
      const body = req.body as { items?: unknown; item?: unknown };
      const payload = Array.isArray(body.items) ? body.items : Array.isArray(req.body) ? req.body : [body.item ?? req.body];
      const items = payload.map((item) => withId(item, prefix));
      const saved = items.length === 1 ? [await collection.save(items[0])] : await collection.saveMany(items);
      ok(res, items.length === 1 ? saved[0] : saved, "saved");
    } catch (error) {
      fail(res, error);
    }
  };
}

function putCollection(collection: { getAll: () => Promise<OperationStoredItem[]>; save: (item: OperationStoredItem) => Promise<OperationStoredItem> }) {
  return async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(firstParam(req.params.id)).trim();
      if (!id) {
        res.status(400).json({ success: false, data: null, message: "id is required" });
        return;
      }
      const current = (await collection.getAll()).find((item) => item.id === id);
      const incoming = withId({ ...(isRecord(current) ? current : {}), ...(isRecord(req.body) ? req.body : {}), id }, id);
      ok(res, await collection.save(incoming), "saved");
    } catch (error) {
      fail(res, error);
    }
  };
}

function deleteCollection(collection: { delete: (id: string) => Promise<boolean> }) {
  return async (req: Request, res: Response) => {
    try {
      const id = decodeURIComponent(firstParam(req.params.id)).trim();
      if (!id) {
        res.status(400).json({ success: false, data: null, message: "id is required" });
        return;
      }
      ok(res, { deleted: await collection.delete(id) }, "deleted");
    } catch (error) {
      fail(res, error);
    }
  };
}

router.get("/ai-coaching-history", async (_req, res) => {
  try {
    ok(res, await operationStorageService.aiCoachingHistory.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/ai-coaching-history", postCollection(operationStorageService.aiCoachingHistory, "ai-history"));

router.get("/ai-coaching-history/week/:weekKey", async (req, res) => {
  try {
    const weekKey = decodeURIComponent(req.params.weekKey).trim();
    ok(
      res,
      (await operationStorageService.aiCoachingHistory.getAll()).filter((entry) => String(entry.weekKey ?? "").trim() === weekKey)
    );
  } catch (error) {
    fail(res, error);
  }
});

router.get("/ai-coaching-history/:riderName", async (req, res) => {
  try {
    const riderName = decodeURIComponent(req.params.riderName).trim();
    ok(
      res,
      (await operationStorageService.aiCoachingHistory.getAll()).filter((entry) => String(entry.riderName ?? "").trim() === riderName)
    );
  } catch (error) {
    fail(res, error);
  }
});

router.get("/action-checklists", async (_req, res) => {
  try {
    ok(res, await operationStorageService.managerActionChecklists.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/action-checklists", postCollection(operationStorageService.managerActionChecklists, "action-checklist"));

router.get("/action-checklists/:riderName/:weekKey", async (req, res) => {
  try {
    const riderName = decodeURIComponent(req.params.riderName).trim();
    const weekKey = decodeURIComponent(req.params.weekKey).trim();
    ok(
      res,
      (await operationStorageService.managerActionChecklists.getAll()).find(
        (entry) => String(entry.riderName ?? "").trim() === riderName && String(entry.weekKey ?? "").trim() === weekKey
      ) ?? null
    );
  } catch (error) {
    fail(res, error);
  }
});

router.get("/weekly-briefings", async (_req, res) => {
  try {
    ok(res, await operationStorageService.weeklyBriefings.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/weekly-briefings", postCollection(operationStorageService.weeklyBriefings, "weekly-briefing"));

router.get("/monthly-reports", async (_req, res) => {
  try {
    ok(res, await operationStorageService.monthlyReports.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/monthly-reports", postCollection(operationStorageService.monthlyReports, "monthly-report"));

router.get("/message-copy-history", async (_req, res) => {
  try {
    ok(res, await operationStorageService.messageCopyHistory.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/message-copy-history", postCollection(operationStorageService.messageCopyHistory, "message-copy"));

router.get("/message-queue", async (_req, res) => {
  try {
    ok(res, await operationStorageService.messageQueue.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/message-queue", postCollection(operationStorageService.messageQueue, "message-queue"));
router.put("/message-queue/:id", putCollection(operationStorageService.messageQueue));
router.delete("/message-queue/:id", deleteCollection(operationStorageService.messageQueue));

router.get("/message-send-history", async (_req, res) => {
  try {
    ok(res, await operationStorageService.messageSendHistory.getAll());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/message-send-history", postCollection(operationStorageService.messageSendHistory, "message-send-history"));

router.post("/backup-meta", postCollection(operationStorageService.backupMeta, "backup-meta"));
router.post("/ai-status-results", postCollection(operationStorageService.aiStatusChecks, "ai-status"));

router.get("/logs", async (_req, res) => {
  try {
    ok(res, await operationStorageService.operationLogs.getLatest());
  } catch (error) {
    fail(res, error);
  }
});

router.post("/logs", async (req, res) => {
  try {
    const body = withId(req.body, "operation-log") as unknown as Partial<OperationLogEntry> & { id: string };
    const entry: OperationLogEntry = {
      id: body.id,
      actionType: body.actionType ?? "AI_COACHING_GENERATED",
      actorRole: body.actorRole === "rider" ? "rider" : "admin",
      actorName: typeof body.actorName === "string" ? body.actorName : "관리자",
      riderName: typeof body.riderName === "string" ? body.riderName : undefined,
      weekKey: typeof body.weekKey === "string" ? body.weekKey : undefined,
      monthKey: typeof body.monthKey === "string" ? body.monthKey : undefined,
      summary: typeof body.summary === "string" ? body.summary : "",
      createdAt: typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString()
    };
    ok(res, await operationStorageService.operationLogs.save(entry), "saved");
  } catch (error) {
    fail(res, error);
  }
});

export default router;
