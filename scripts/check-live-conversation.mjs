// 명시적으로 --run을 줄 때만 구독 CLI로 합성 문답 두 번을 확인합니다. 일반 테스트에 포함하지 않습니다.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { askForReal, buildAsk } from '../installer/windows/ask-once.mjs';

const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
if (!args.includes('--run') || !args.includes('--cli') || !args.includes('--exe')) {
  throw new Error('Usage: node scripts/check-live-conversation.mjs --run --cli <OAuth CLI executable> --exe <host executable>');
}
const env = { ...process.env };
for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLASSMATE_CODEX_CLI', 'CLASSMATE_CLAUDE_MODEL', 'CLASSMATE_TUTOR_SESSION']) delete env[key];
env.CLASSMATE_CLAUDE_CLI = resolve(value('--cli'));
env.CLASSMATE_DATA_DIR = mkdtempSync(join(tmpdir(), 'classmate-dialogue-smoke-'));
const questions = [
  '스프링을 왜 쓰는지 처음 배우는 중학생도 알 수 있게 자세히 설명해 주세요. 설명 예시에서 주문을 저장하는 부품의 별명은 보라상자라고 해 주세요.',
  '방금 주문을 저장하는 부품에 내가 붙인 별명이 뭐였지? 그 별명을 써서 왜 스프링이 필요한지 더 쉽게 설명해 주세요.',
];
for (const [index, question] of questions.entries()) {
  const ask = { ...buildAsk({ question, kind: 'free' }), questionId: `q-1999-01-01-p1-dialogue-${index + 1}` };
  const result = await askForReal(resolve(value('--exe')), ask, env, { timeoutMs: 90_000 });
  const response = result.frames.findLast((frame) => frame.type === 'tutor.event' && frame.event?.payload?.answer)?.event.payload.answer;
  if (!response) throw new Error(`Turn ${index + 1}: no completed answer (timeout=${result.timedOut})`);
  const body = response.details?.why ?? '';
  const remembers = `${response.conclusion}\n${body}`.includes('보라상자');
  console.log(JSON.stringify({ turn: index + 1, conclusion: response.conclusion, explanationChars: [...body].length, paragraphs: body.split(/\n\s*\n/).length, remembers, explanation: body }));
  if (body.length < 100 || !remembers) throw new Error(`Turn ${index + 1}: explanation/context quality check failed`);
}
console.log('PASS: 두 번째 질문은 새 호스트 프로세스에서 로컬 문답을 읽어 이어 답했습니다.');
