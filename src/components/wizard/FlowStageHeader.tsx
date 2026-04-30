/**
 * @fileoverview FlowStageHeader — small header showing league name + stage progress
 */

interface FlowStageHeaderProps {
  leagueName?: string;
  index: number;
  total: number;
  title: string;
}

export function FlowStageHeader({ leagueName, index, total, title }: FlowStageHeaderProps) {
  return (
    <div className="text-center">
      {leagueName && (
        <p className="text-sm font-semibold text-foreground">{leagueName}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Stage {index + 1} of {total}: {title}
      </p>
    </div>
  );
}
