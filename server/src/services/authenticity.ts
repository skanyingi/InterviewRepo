export interface AnswerSignals {
  focusMs: number;
  keystrokes: number;
  pasteCount: number;
  pastedChars: number;
}

export type AuthenticityLevel = 'low' | 'medium' | 'high';

export interface AuthenticitySummary {
  level: AuthenticityLevel;
  score: number;
  reasons: string[];
}

const MAX_MS = 24 * 60 * 60 * 1000;

function clampInt(value: unknown, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(max, number));
}

export function parseSignals(raw: unknown): AnswerSignals | null {
  if (!raw || typeof raw !== 'object') return null;

  const item = raw as Record<string, unknown>;
  const signals: AnswerSignals = {
    focusMs: clampInt(item.focusMs, MAX_MS),
    keystrokes: clampInt(item.keystrokes, 100000),
    pasteCount: clampInt(item.pasteCount, 10000),
    pastedChars: clampInt(item.pastedChars, 100000),
  };

  if (
    signals.focusMs === 0 &&
    signals.keystrokes === 0 &&
    signals.pasteCount === 0 &&
    signals.pastedChars === 0
  ) {
    return null;
  }

  return signals;
}

export function parseStoredSignals(raw: string | null): AnswerSignals | null {
  if (!raw) return null;
  try {
    return parseSignals(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function estimateAiAssistance(
  textLength: number,
  signals: AnswerSignals | null,
): { score: number; reasons: string[] } | null {
  if (!signals || textLength === 0) return null;

  let score = 0;
  const reasons: string[] = [];
  const pastedRatio = Math.min(1, signals.pastedChars / textLength);

  if (pastedRatio >= 0.8) {
    score += 50;
    reasons.push('mostly pasted');
  } else if (pastedRatio >= 0.4) {
    score += 25;
    reasons.push('partly pasted');
  }

  if (signals.focusMs > 0 && signals.focusMs < 15000 && textLength > 400) {
    score += 25;
    reasons.push('very fast for the length');
  }

  if (signals.keystrokes === 0 && textLength > 200) {
    score += 20;
    reasons.push('no typing detected');
  } else if (signals.keystrokes > 0 && signals.keystrokes < textLength / 5) {
    score += 10;
    reasons.push('little typing relative to length');
  }

  return { score: Math.min(100, score), reasons };
}

export function summarizeAnswers(
  rows: { text: string; signals: string | null; aiScore: number | null }[],
): AuthenticitySummary | null {
  if (rows.length === 0) return null;

  let best: { score: number; reasons: string[] } | null = null;

  for (const row of rows) {
    const estimate = estimateAiAssistance(row.text.length, parseStoredSignals(row.signals));
    const score = row.aiScore ?? estimate?.score ?? 0;
    const reasons = estimate?.reasons ?? [];
    if (!best || score > best.score) {
      best = { score, reasons };
    }
  }

  if (!best || (best.score === 0 && best.reasons.length === 0)) {
    return null;
  }

  const level: AuthenticityLevel = best.score >= 60 ? 'high' : best.score >= 30 ? 'medium' : 'low';
  return { level, score: best.score, reasons: best.reasons };
}
