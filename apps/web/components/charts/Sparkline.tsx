"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { Tone } from "@/features/batches/lib/status";
import { useThemeTokens, type ThemeTokens } from "./useThemeTokens";

const TONE_KEY: Record<Tone, keyof ThemeTokens> = {
  success: "success",
  accent: "accent",
  warning: "warning",
  error: "error",
  neutral: "muted",
};

/** Label-free trend line for metric cards. Decorative; the number beside it is the value. */
export function Sparkline({ data, tone = "accent", width = 72, height = 28 }: { data: number[]; tone?: Tone; width?: number; height?: number }) {
  const tokens = useThemeTokens();
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height }} aria-hidden>
      {tokens ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line type="monotone" dataKey="v" stroke={tokens[TONE_KEY[tone]]} strokeWidth={1.75} dot={false} isAnimationActive animationDuration={600} />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
