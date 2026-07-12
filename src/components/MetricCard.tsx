import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon: ReactNode;
  tone?: "cyan" | "red" | "amber" | "violet";
  hint: string;
}

export function MetricCard({
  title,
  value,
  suffix,
  icon,
  tone = "cyan",
  hint
}: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>

      <div className="metric-content">
        <span>{title}</span>

        <strong>
          {value}
          {suffix && <small>{suffix}</small>}
        </strong>

        <p>{hint}</p>
      </div>
    </article>
  );
}