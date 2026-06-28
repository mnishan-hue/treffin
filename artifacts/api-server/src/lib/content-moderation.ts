const TOXIC_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bf+u+c+k\b/i,                                              weight: 0.7, label: "profanity" },
  { pattern: /\bs+h+i+t\b/i,                                              weight: 0.55, label: "profanity" },
  { pattern: /\ba+s+s+h+o+l+e\b/i,                                        weight: 0.65, label: "profanity" },
  { pattern: /\bb+i+t+c+h\b/i,                                            weight: 0.55, label: "profanity" },
  { pattern: /\bc+u+n+t\b/i,                                              weight: 0.9,  label: "severe_profanity" },
  { pattern: /\bd+i+c+k\s*(head|face|wad)?\b/i,                          weight: 0.5,  label: "profanity" },
  { pattern: /\bn[i1][g9]+[e3]r\b/i,                                      weight: 1.0,  label: "hate_speech" },
  { pattern: /\bf[a4][g9]+[o0]+t\b/i,                                     weight: 1.0,  label: "hate_speech" },
  { pattern: /\bk[i1]ll\s+your\s*self\b/i,                               weight: 1.0,  label: "self_harm" },
  { pattern: /\bkys\b/i,                                                   weight: 1.0,  label: "self_harm" },
  { pattern: /\b(go\s+die|should\s+die|ought\s+to\s+die)\b/i,            weight: 0.9,  label: "severe_threat" },
  { pattern: /\b(i('ll| will)|gonna|going to)\s+(kill|murder|hurt|stab|shoot)\s+(you|him|her|them|u)\b/i, weight: 0.95, label: "threat" },
  { pattern: /\byou\s*(are|'re)\s+(a\s+)?(worthless|disgusting|pathetic|retarded|subhuman)\b/i, weight: 0.7, label: "harassment" },
  { pattern: /\b(rape|molest)\s+(you|him|her|them|u)\b/i,                weight: 1.0,  label: "severe" },
];

const AI_PHRASES: Array<{ phrase: string; weight: number }> = [
  { phrase: "as an ai",                  weight: 0.60 },
  { phrase: "i hope this helps",         weight: 0.35 },
  { phrase: "i hope this article",       weight: 0.25 },
  { phrase: "let's delve",               weight: 0.20 },
  { phrase: "delve into",                weight: 0.18 },
  { phrase: "it is worth noting",        weight: 0.15 },
  { phrase: "it is important to note",   weight: 0.12 },
  { phrase: "this article explores",     weight: 0.15 },
  { phrase: "in the realm of",           weight: 0.13 },
  { phrase: "tapestry of",               weight: 0.15 },
  { phrase: "nuanced understanding",     weight: 0.13 },
  { phrase: "multifaceted",              weight: 0.10 },
  { phrase: "bustling",                  weight: 0.12 },
  { phrase: "pivotal",                   weight: 0.08 },
  { phrase: "in conclusion,",            weight: 0.10 },
  { phrase: "in summary,",               weight: 0.10 },
  { phrase: "furthermore,",              weight: 0.09 },
  { phrase: "moreover,",                 weight: 0.09 },
  { phrase: "additionally,",             weight: 0.07 },
  { phrase: "it should be noted",        weight: 0.10 },
  { phrase: "as we know,",               weight: 0.09 },
  { phrase: "groundbreaking",            weight: 0.06 },
  { phrase: "let's explore",             weight: 0.09 },
  { phrase: "comprehensive guide",       weight: 0.12 },
  { phrase: "robust solution",           weight: 0.10 },
];

export interface ToxicityResult {
  blocked: boolean;
  flagged: boolean;
  score: number;
  reason?: string;
}

export interface AiDetectionResult {
  flagged: boolean;
  score: number;
  patterns: string[];
}

export interface SourceCheckResult {
  required: boolean;
  hasSources: boolean;
}

export function checkToxicity(text: string): ToxicityResult {
  let score = 0;
  let topLabel: string | undefined;

  for (const { pattern, weight, label } of TOXIC_PATTERNS) {
    if (pattern.test(text)) {
      score = Math.min(1, score + weight);
      if (!topLabel) topLabel = label;
    }
  }

  return {
    blocked: score >= 0.7,
    flagged: score >= 0.3,
    score,
    reason: score >= 0.3 ? topLabel : undefined,
  };
}

export function detectAiContent(text: string): AiDetectionResult {
  if (text.length < 120) return { flagged: false, score: 0, patterns: [] };

  const lower = text.toLowerCase();
  let score = 0;
  const matched: string[] = [];

  for (const { phrase, weight } of AI_PHRASES) {
    if (lower.includes(phrase)) {
      score += weight;
      matched.push(phrase);
    }
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const contractions = (text.match(/\b\w+'\w+\b/g) ?? []).length;
  if (wordCount > 120 && contractions === 0) {
    score += 0.14;
    matched.push("no_contractions");
  }

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 2) {
    const avgWordsPerSentence = wordCount / sentences.length;
    if (avgWordsPerSentence > 28) {
      score += 0.10;
      matched.push("long_avg_sentence");
    }
  }

  const transitionCount = (lower.match(/\b(furthermore|moreover|additionally|however|nevertheless|consequently|therefore)\b/g) ?? []).length;
  if (transitionCount >= 3) {
    score += 0.12;
    matched.push("excessive_transitions");
  }

  return {
    flagged: score >= 0.50,
    score: Math.min(1, score),
    patterns: matched,
  };
}

export function checkSourceRequirement(text: string, wordThreshold: number): SourceCheckResult {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const required = wordCount >= wordThreshold;
  const hasSources = /https?:\/\/[^\s]+/.test(text);
  return { required, hasSources };
}
