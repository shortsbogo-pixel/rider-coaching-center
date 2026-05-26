import { access, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { checkOllamaStatus, type OllamaStatusResult } from "./aiCoachingService";

type HealthStatus = "ok" | "warning" | "fail";

export interface HealthSummary {
  success: boolean;
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  version: string;
}

interface FullHealthOptions {
  startedAt?: number;
  version?: string;
  dataDir?: string;
  operationFileNames?: string[];
  checkOllama?: () => Promise<OllamaStatusResult>;
}

interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
}

export interface FullHealthReport extends HealthSummary {
  server: {
    status: HealthStatus;
    message: string;
  };
  dataDirectory: {
    path: string;
    accessible: boolean;
    writable: boolean;
    status: HealthStatus;
    message: string;
  };
  operationDataFiles: Array<{
    fileName: string;
    exists: boolean;
    readable: boolean;
    jsonArray: boolean;
    status: HealthStatus;
    message: string;
  }>;
  ollama: {
    connected: boolean;
    gemmaResponding: boolean;
    model: string;
    checkedAt: string;
    fallbackAvailable: boolean;
    fallbackUsed: boolean;
    status: HealthStatus;
    message: string;
  };
  gitIgnore: {
    envIgnored: boolean;
    backendDataIgnored: boolean;
    status: HealthStatus;
    message: string;
  };
  checks: HealthCheckItem[];
}

export const operationHealthFileNames = [
  "ai-coaching-history.json",
  "manager-action-checklists.json",
  "weekly-briefings.json",
  "monthly-reports.json",
  "operation-briefings.json",
  "message-queue.json",
  "message-send-history.json",
  "operation-logs.json"
];

function uptimeSeconds(startedAt = Date.now()) {
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

function overallStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

export function buildHealthSummary(options: { startedAt?: number; version?: string } = {}): HealthSummary {
  return {
    success: true,
    status: "ok",
    uptime: uptimeSeconds(options.startedAt),
    timestamp: new Date().toISOString(),
    version: options.version ?? process.env.npm_package_version ?? "0.1.0"
  };
}

async function checkDataDirectory(dataDir: string) {
  try {
    await mkdir(dataDir, { recursive: true });
    await access(dataDir, constants.R_OK | constants.W_OK);
    const probePath = join(dataDir, `.health-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    await writeFile(probePath, "ok", "utf8");
    await unlink(probePath);
    return {
      path: dataDir,
      accessible: true,
      writable: true,
      status: "ok" as HealthStatus,
      message: "backend/data directory is accessible and writable."
    };
  } catch (error) {
    return {
      path: dataDir,
      accessible: false,
      writable: false,
      status: "fail" as HealthStatus,
      message: error instanceof Error ? error.message : "backend/data directory check failed."
    };
  }
}

async function checkOperationDataFile(dataDir: string, fileName: string) {
  const filePath = join(dataDir, fileName);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const jsonArray = Array.isArray(parsed);
    return {
      fileName,
      exists: true,
      readable: true,
      jsonArray,
      status: jsonArray ? ("ok" as HealthStatus) : ("fail" as HealthStatus),
      message: jsonArray ? "JSON array file is readable." : "JSON file is not an array."
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        fileName,
        exists: false,
        readable: false,
        jsonArray: false,
        status: "warning" as HealthStatus,
        message: "File is missing and will be created on first use."
      };
    }
    return {
      fileName,
      exists: true,
      readable: false,
      jsonArray: false,
      status: "fail" as HealthStatus,
      message: error instanceof Error ? error.message : "Operation data file check failed."
    };
  }
}

async function checkGitIgnore() {
  try {
    const raw = await readFile(resolve(process.cwd(), ".gitignore"), "utf8");
    const envIgnored = raw.split(/\r?\n/).some((line) => line.trim() === ".env");
    const backendDataIgnored = raw.includes("backend/data/*.json") || raw.includes("backend/src/data/*.json");
    const status = envIgnored && backendDataIgnored ? "ok" : "warning";
    return {
      envIgnored,
      backendDataIgnored,
      status: status as HealthStatus,
      message: status === "ok" ? ".env and backend data JSON files are ignored." : "Review .gitignore before deployment."
    };
  } catch (error) {
    return {
      envIgnored: false,
      backendDataIgnored: false,
      status: "warning" as HealthStatus,
      message: error instanceof Error ? error.message : ".gitignore check failed."
    };
  }
}

function normalizeOllamaStatus(status: OllamaStatusResult) {
  const normalizedStatus: HealthStatus = status.ollamaConnected && status.gemmaResponding ? "ok" : status.ollamaConnected ? "warning" : "fail";
  return {
    connected: status.ollamaConnected,
    gemmaResponding: status.gemmaResponding,
    model: status.model,
    checkedAt: status.checkedAt,
    fallbackAvailable: true,
    fallbackUsed: status.fallbackUsed,
    status: normalizedStatus,
    message: status.message
  };
}

export async function buildFullHealthReport(options: FullHealthOptions = {}): Promise<FullHealthReport> {
  const dataDir = options.dataDir ?? resolve(process.cwd(), "backend/data");
  const fileNames = options.operationFileNames ?? operationHealthFileNames;
  const [dataDirectory, operationDataFiles, ollamaStatus, gitIgnore] = await Promise.all([
    checkDataDirectory(dataDir),
    Promise.all(fileNames.map((fileName) => checkOperationDataFile(dataDir, fileName))),
    (options.checkOllama ?? checkOllamaStatus)().then(normalizeOllamaStatus).catch((error) => ({
      connected: false,
      gemmaResponding: false,
      model: process.env.OLLAMA_MODEL ?? "gemma4:e2b",
      checkedAt: new Date().toISOString(),
      fallbackAvailable: true,
      fallbackUsed: true,
      status: "fail" as HealthStatus,
      message: error instanceof Error ? error.message : "Ollama health check failed."
    })),
    checkGitIgnore()
  ]);

  const checks: HealthCheckItem[] = [
    { id: "server", label: "Backend server", status: "ok", message: "Express server is responding." },
    { id: "data-directory", label: "Data directory", status: dataDirectory.status, message: dataDirectory.message },
    { id: "operation-files", label: "Operation data files", status: overallStatus(operationDataFiles.map((item) => item.status)), message: "Operation JSON files checked." },
    { id: "ollama", label: "Ollama connection", status: ollamaStatus.connected ? "ok" : "fail", message: ollamaStatus.message },
    { id: "gemma", label: "Gemma response", status: ollamaStatus.gemmaResponding ? "ok" : "warning", message: ollamaStatus.message },
    { id: "gitignore", label: "Git ignore rules", status: gitIgnore.status, message: gitIgnore.message }
  ];
  const summary = buildHealthSummary({ startedAt: options.startedAt, version: options.version });
  const status = overallStatus(checks.map((item) => item.status));

  return {
    ...summary,
    status,
    server: {
      status: "ok",
      message: "Express server is responding."
    },
    dataDirectory,
    operationDataFiles,
    ollama: ollamaStatus,
    gitIgnore,
    checks
  };
}
