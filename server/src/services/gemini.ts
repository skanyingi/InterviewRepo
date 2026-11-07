import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  client ??= new GoogleGenAI({ apiKey: config.gemini.apiKey, apiVersion: 'v1beta' });
  return client;
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export async function generateQuestions(
  repoFullName: string,
  focusArea: string,
  code: string,
): Promise<string[]> {
  const prompt = `You are writing questions for a technical interview based on a real codebase.

Repository: ${repoFullName}
Focus area: ${focusArea}

Write 6 short, specific interview questions about the "${focusArea}" part of this codebase.
Each question must reference the actual code and be answerable in a sentence or two.
Do not include answers.

Respond with JSON only, in this exact shape:
{"questions": ["question 1", "question 2"]}

SOURCE CODE:
${code}`;

  const response = await getClient().models.generateContent({
    model: config.gemini.model,
    contents: prompt,
    config: { temperature: 0.4, responseMimeType: 'application/json' },
  });

  const parsed = parseJson<{ questions?: unknown }>(response.text ?? '');
  const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const questions = raw
    .filter((question): question is string => typeof question === 'string')
    .map((question) => question.trim())
    .filter((question) => question.length > 0);

  if (questions.length === 0) {
    throw new Error('The model did not return any questions');
  }

  return questions.slice(0, 8);
}

export interface GradedAnswer {
  score: number;
  feedback: string;
}

export async function gradeAnswers(
  focusArea: string,
  repoFullName: string,
  items: { question: string; answer: string }[],
): Promise<GradedAnswer[]> {
  const questionsText = items
    .map(
      (item, index) =>
        `${index + 1}. Question: ${item.question}\nApplicant answer: ${item.answer}`,
    )
    .join('\n\n');

  const prompt = `You are grading a technical interview for the focus area "${focusArea}" of the repository ${repoFullName}.

For each numbered question below, score the applicant's answer from 0 to 10 (10 = fully correct, specific and technically accurate; 0 = missing or completely wrong) and give one short sentence of feedback.

Respond with JSON only, in this exact shape, with exactly ${items.length} scores in the same order as the questions:
{"scores":[{"score":8,"feedback":"one sentence"}]}

${questionsText}`;

  const response = await getClient().models.generateContent({
    model: config.gemini.model,
    contents: prompt,
    config: { temperature: 0.2, responseMimeType: 'application/json' },
  });

  const parsed = parseJson<{ scores?: unknown }>(response.text ?? '');
  const raw = Array.isArray(parsed?.scores) ? parsed.scores : [];

  if (raw.length !== items.length) {
    throw new Error('The model returned an unexpected number of scores');
  }

  return raw.map((entry) => {
    const item = entry as { score?: unknown; feedback?: unknown };
    const score =
      typeof item.score === 'number' ? Math.max(0, Math.min(10, Math.round(item.score))) : 0;
    const feedback = typeof item.feedback === 'string' ? item.feedback.trim() : '';
    return { score, feedback };
  });
}
