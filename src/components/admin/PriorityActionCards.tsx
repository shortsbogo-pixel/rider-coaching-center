interface PriorityActionCardsProps {
  actions: string[];
  onActionClick?: (action: string, index: number) => void;
}

export function PriorityActionCards({ actions, onActionClick }: PriorityActionCardsProps) {
  const visibleActions = actions.slice(0, 3);
  return (
    <div className="priority-action-grid">
      {visibleActions.map((action, index) => (
        <button
          className="priority-action-card"
          key={`${index}-${action}`}
          type="button"
          onClick={() => onActionClick?.(action, index)}
        >
          <span>오늘의 우선 조치 {index + 1}</span>
          <strong>{action}</strong>
        </button>
      ))}
    </div>
  );
}
