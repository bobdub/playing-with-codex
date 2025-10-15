const BANNED_PATTERNS: RegExp[] = [
  /\b(?:harm|kill|suicide|violence|weapon)\b/i,
  /\b(?:terror|bomb|explosive)\b/i,
  /\b(?:hate\s*speech|genocide)\b/i
];

export interface EthicsEvaluation {
  safe: boolean;
  reason?: string;
  stability: '0.0(e)';
}

export function evaluateImaginationOutput(output: string): EthicsEvaluation {
  const trimmed = output.trim();

  if (!trimmed) {
    return {
      safe: false,
      reason: 'Empty imagination output. The network needs a more detailed seed.',
      stability: '0.0(e)'
    };
  }

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason: 'Ethics Keeper intercepted unsafe content in the generated response.',
        stability: '0.0(e)'
      };
    }
  }

  return {
    safe: true,
    stability: '0.0(e)'
  };
}
