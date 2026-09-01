"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Tone } from "@/features/batches/lib/status";
import { useThemeTokens, type ThemeTokens } from "./useThemeTokens";

export interface DonutSegment {
  label: string;
  value: number;
  tone: Tone;
}

const TONE_KEY: Record<Tone, keyof ThemeTokens> = {
  success: "success",
  accent: "accent",
  warning: "warning",
  error: "error",
  neutral: "muted",
};

/**
 * Informational donut (Recharts) with a center metric. Colors come from design
 * tokens resolved at runtime so it follows light/dark. Animates on mount. The
 * legend rendered by the caller carries the same numbers as text, so meaning
 * never depends on the ring alone.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 14,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  thickness?: number;
}) {
  const tokens = useThemeTokens();
  const data = segments.filter((s) => s.value > 0);
  const outer = size / 2;
  const inner = outer - thickness;

  return (
    <div style={{ position: "relative", width: size, height: size }} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
      {tokens ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              startAngle={90}
              endAngle={-270}
              paddingAngle={data.length > 1 ? 1.5 : 0}
              stroke="none"
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            >
              {data.map((s) => (
                <Cell key={s.label} fill={tokens[TONE_KEY[s.tone]]} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                background: tokens.surface,
                border: `1px solid ${tokens.border}`,
                borderRadius: 8,
                fontSize: 12,
                color: tokens.text,
                boxShadow: "var(--shadow-md)",
              }}
              itemStyle={{ color: tokens.text }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : null}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span className="tabular" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
          {centerValue}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{centerLabel}</span>
      </div>
    </div>
  );
}
