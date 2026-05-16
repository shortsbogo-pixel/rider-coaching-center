import type { CSSProperties } from "react";

export function ScoreRing({ score }: { score: number }) {
  return (
    <div className="score-ring" style={{ "--score": `${score}%` } as CSSProperties}>
      <div>
        <strong>{score}</strong>
        <span>점</span>
      </div>
    </div>
  );
}
