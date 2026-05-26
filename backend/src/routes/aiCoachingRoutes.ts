import { Router } from "express";
import type { Request, Response } from "express";
import { generateAICoachingMessages, getDefaultCoachingMessages } from "../services/aiCoachingService";
import { saveAICoachingHistory, getAICoachingHistory } from "../services/aiCoachingHistoryService";
import type { RiderRiskLevel } from "../../../src/types/rider";
import type { AICoachingHistoryEntry } from "../../../src/types/aiCoaching";

const router = Router();

router.use((req, res, next) => {
  if (req.header("x-user-role") !== "admin") {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
});

interface GenerateCoachingRequest {
  riderId?: string;
  riderName: string;
  weekKey?: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: RiderRiskLevel;
}

// POST /api/ai-coaching/generate - AI 코칭 메시지 생성
router.post("/generate", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Partial<GenerateCoachingRequest>;

    // 입력값 검증
    if (!body.riderName || typeof body.riderName !== "string") {
      res.status(400).json({ message: "riderName(문자열)이 필요합니다." });
      return;
    }

    if (typeof body.previousWeekCompleted !== "number" || body.previousWeekCompleted < 0) {
      res.status(400).json({ message: "previousWeekCompleted(0 이상의 숫자)이 필요합니다." });
      return;
    }

    if (typeof body.currentWeekCompleted !== "number" || body.currentWeekCompleted < 0) {
      res.status(400).json({ message: "currentWeekCompleted(0 이상의 숫자)이 필요합니다." });
      return;
    }

    if (typeof body.changeRate !== "number" || isNaN(body.changeRate)) {
      res.status(400).json({ message: "changeRate(숫자)이 필요합니다." });
      return;
    }

    const validRiskLevels: RiderRiskLevel[] = ["고위험", "관리주의", "허용", "안정", "에이스"];
    if (!validRiskLevels.includes(body.riskLevel as RiderRiskLevel)) {
      res.status(400).json({ message: `riskLevel은 다음 중 하나여야 합니다: ${validRiskLevels.join(", ")}` });
      return;
    }

    const result = await generateAICoachingMessages({
      riderName: body.riderName,
      previousWeekCompleted: body.previousWeekCompleted,
      currentWeekCompleted: body.currentWeekCompleted,
      changeRate: body.changeRate,
      riskLevel: body.riskLevel as RiderRiskLevel
    });

    const historyEntry: AICoachingHistoryEntry = {
      id: `${body.weekKey ?? "unknown"}::${body.riderId ?? body.riderName}::${Date.now()}`,
      riderId: body.riderId ?? body.riderName,
      riderName: body.riderName,
      weekKey: body.weekKey ?? "",
      previousWeekCompleted: body.previousWeekCompleted,
      currentWeekCompleted: body.currentWeekCompleted,
      changeRate: body.changeRate,
      riskLevel: body.riskLevel as RiderRiskLevel,
      adminMessage: result.adminMessage,
      riderMessage: result.riderMessage,
      isTemplate: result.isTemplate,
      generatedAt: new Date().toISOString()
    };

    saveAICoachingHistory(historyEntry).catch(() => {
      console.warn("AI coaching history save failed for", historyEntry.riderId);
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai-coaching/template - 기본 템플릿 메시지 조회 (Ollama 없이도 사용 가능)
router.post("/template", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as Partial<GenerateCoachingRequest>;

    // 입력값 검증
    if (!body.riderName || typeof body.riderName !== "string") {
      res.status(400).json({ message: "riderName(문자열)이 필요합니다." });
      return;
    }

    if (typeof body.previousWeekCompleted !== "number" || body.previousWeekCompleted < 0) {
      res.status(400).json({ message: "previousWeekCompleted(0 이상의 숫자)이 필요합니다." });
      return;
    }

    if (typeof body.currentWeekCompleted !== "number" || body.currentWeekCompleted < 0) {
      res.status(400).json({ message: "currentWeekCompleted(0 이상의 숫자)이 필요합니다." });
      return;
    }

    if (typeof body.changeRate !== "number" || isNaN(body.changeRate)) {
      res.status(400).json({ message: "changeRate(숫자)이 필요합니다." });
      return;
    }

    const validRiskLevels: RiderRiskLevel[] = ["고위험", "관리주의", "허용", "안정", "에이스"];
    if (!validRiskLevels.includes(body.riskLevel as RiderRiskLevel)) {
      res.status(400).json({ message: `riskLevel은 다음 중 하나여야 합니다: ${validRiskLevels.join(", ")}` });
      return;
    }

    const result = getDefaultCoachingMessages({
      riderName: body.riderName,
      previousWeekCompleted: body.previousWeekCompleted,
      currentWeekCompleted: body.currentWeekCompleted,
      changeRate: body.changeRate,
      riskLevel: body.riskLevel as RiderRiskLevel
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

interface BatchCoachingItem {
  riderId: string;
  riderName: string;
  weekKey: string;
  previousWeekCompleted: number;
  currentWeekCompleted: number;
  changeRate: number;
  riskLevel: RiderRiskLevel;
}

interface BatchCoachingResponseItem {
  riderId: string;
  adminMessage: string;
  riderMessage: string;
  isTemplate: boolean;
  error?: string;
}

async function generateBatchCoaching(items: BatchCoachingItem[]): Promise<BatchCoachingResponseItem[]> {
  const concurrency = Math.max(1, Number(process.env.BATCH_CONCURRENCY ?? 4));
  let nextIndex = 0;
  const results: BatchCoachingResponseItem[] = [];

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      try {
        const result = await generateAICoachingMessages({
          riderName: item.riderName,
          previousWeekCompleted: item.previousWeekCompleted,
          currentWeekCompleted: item.currentWeekCompleted,
          changeRate: item.changeRate,
          riskLevel: item.riskLevel
        });

        const historyEntry: AICoachingHistoryEntry = {
          id: `${item.weekKey ?? "unknown"}::${item.riderId}::${Date.now()}-${Math.random().toString(36).slice(2)}`,
          riderId: item.riderId,
          riderName: item.riderName,
          weekKey: item.weekKey,
          previousWeekCompleted: item.previousWeekCompleted,
          currentWeekCompleted: item.currentWeekCompleted,
          changeRate: item.changeRate,
          riskLevel: item.riskLevel,
          adminMessage: result.adminMessage,
          riderMessage: result.riderMessage,
          isTemplate: result.isTemplate,
          generatedAt: new Date().toISOString()
        };

        await saveAICoachingHistory(historyEntry);

        results[currentIndex] = {
          riderId: item.riderId,
          adminMessage: result.adminMessage,
          riderMessage: result.riderMessage,
          isTemplate: result.isTemplate
        };
      } catch (error) {
        results[currentIndex] = {
          riderId: item.riderId,
          adminMessage: `⚠️ [${item.riderName}] AI 생성 중 오류가 발생했습니다.`,
          riderMessage: `${item.riderName}님, AI 코칭 생성 중 문제가 발생했습니다.`,
          isTemplate: true,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// POST /api/ai-coaching/batch - 다수 라이더에 대한 AI 코칭 메시지 일괄 생성
router.post("/batch", async (req: Request, res: Response, next) => {
  try {
    const body = req.body as { weekKey?: string; items?: Partial<BatchCoachingItem>[] };

    if (!body.weekKey || typeof body.weekKey !== "string") {
      res.status(400).json({ message: "weekKey(문자열)가 필요합니다." });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ message: "items 배열이 필요합니다." });
      return;
    }

    const validRiskLevels: RiderRiskLevel[] = ["고위험", "관리주의", "허용", "안정", "에이스"];
    const batchItems: BatchCoachingItem[] = body.items.map((item) => ({
      riderId: String(item.riderId ?? ""),
      riderName: String(item.riderName ?? ""),
      weekKey: body.weekKey!,
      previousWeekCompleted: Number(item.previousWeekCompleted ?? 0),
      currentWeekCompleted: Number(item.currentWeekCompleted ?? 0),
      changeRate: Number(item.changeRate ?? 0),
      riskLevel: validRiskLevels.includes(item.riskLevel as RiderRiskLevel) ? (item.riskLevel as RiderRiskLevel) : "허용"
    }));

    const results = await generateBatchCoaching(batchItems);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /api/ai-coaching/test - 테스트용 엔드포인트
router.get("/history", async (req: Request, res: Response, next) => {
  try {
    const weekKey = req.query.weekKey?.toString();
    const riderId = req.query.riderId?.toString();
    res.json(await getAICoachingHistory(weekKey, riderId));
  } catch (error) {
    next(error);
  }
});

router.get("/test", async (req: Request, res: Response, next) => {
  try {
    const testInput = {
      riderName: "테스트 라이더",
      previousWeekCompleted: 50,
      currentWeekCompleted: 45,
      changeRate: -10,
      riskLevel: "관리주의" as const
    };

    const result = await generateAICoachingMessages(testInput);

    res.json({
      message: "AI Coaching 테스트 완료",
      input: testInput,
      output: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai-coaching/test/template - 기본 템플릿 테스트
router.get("/test/template", (req: Request, res: Response) => {
  const testInput = {
    riderName: "테스트 라이더",
    previousWeekCompleted: 50,
    currentWeekCompleted: 45,
    changeRate: -10,
    riskLevel: "관리주의" as const
  };

  const result = getDefaultCoachingMessages(testInput);

  res.json({
    message: "기본 템플릿 테스트 완료",
    input: testInput,
    output: result,
    timestamp: new Date().toISOString()
  });
});

export default router;
