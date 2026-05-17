const secretPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: "github-token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { name: "openai-key", regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "aws-access-key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "private-key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  {
    name: "credential-assignment",
    regex: /\b(password|passwd|secret|api[_-]?key|token)\b\s*[:=]\s*["'][^"']{8,}["']/gi
  }
];

export interface RedactionResult {
  text: string;
  redactions: Array<{ type: string; count: number }>;
}

export function redactSecrets(input: string): RedactionResult {
  let text = input;
  const redactions: Array<{ type: string; count: number }> = [];

  for (const pattern of secretPatterns) {
    let count = 0;
    text = text.replace(pattern.regex, () => {
      count += 1;
      return `[REDACTED:${pattern.name}]`;
    });
    if (count > 0) {
      redactions.push({ type: pattern.name, count });
    }
  }

  const entropyResult = redactHighEntropyStrings(text);
  text = entropyResult.text;
  if (entropyResult.count > 0) {
    redactions.push({ type: "high-entropy", count: entropyResult.count });
  }

  return { text, redactions };
}

function redactHighEntropyStrings(input: string): { text: string; count: number } {
  let count = 0;
  const text = input.replace(/\b[A-Za-z0-9+/=_-]{32,}\b/g, (candidate) => {
    if (shannonEntropy(candidate) < 4.2) {
      return candidate;
    }
    count += 1;
    return "[REDACTED:high-entropy]";
  });

  return { text, count };
}

function shannonEntropy(value: string): number {
  const frequencies = new Map<string, number>();
  for (const char of value) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  return [...frequencies.values()].reduce((entropy, frequency) => {
    const probability = frequency / value.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
}
