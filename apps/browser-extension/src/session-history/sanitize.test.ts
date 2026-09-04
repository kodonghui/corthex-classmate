import { describe, expect, it } from 'vitest';

import {
  HIDDEN_SENSITIVE_HISTORY_TEXT,
  sanitizeHistoryDisplayText,
  sanitizeHistoryDisplayTexts,
} from './sanitize';

describe('과거 세션 표시 문자열 안전 경계', () => {
  it.each([
    '읽기 실패: C:\\Users\\learner\\classmate.sqlite',
    '읽기 실패: D:/private/frame.jpg',
    '읽기 실패:path:C:\\Users\\learner\\classmate.sqlite',
    '읽기 실패:[C:\\Users\\learner\\classmate.sqlite]',
    '읽기 실패: \\\\classroom-pc\\recordings\\lesson.db',
    '읽기 실패: //classroom-pc/recordings/lesson.db',
    '읽기 실패: `//classroom-pc/recordings/lesson.db`',
    '읽기 실패: <//classroom-pc/recordings/lesson.db>',
    '읽기 실패:경로//classroom-pc/recordings/lesson.db',
    '읽기 실패: \\Users\\learner\\lesson.db',
    '읽기 실패: C%3A%5CUsers%5Clearner%5Clesson.db',
    '읽기 실패: %2Fhome%2Flearner%2Flesson.db',
    '읽기 실패: file%3A%2F%2F%2FC%3A%2FUsers%2Flearner%2Flesson.db',
    '읽기 실패: %5C%5Cclassroom-pc%5Crecordings%5Clesson.db',
    '읽기 실패: %2525252Fhome%2525252Flearner%2525252Flesson.db',
    '읽기 실패: %2Fhome%2Flearner%2Flesson.db %ZZ',
    '읽기 실패: file:///C:/Users/learner/lesson.db',
    '읽기 실패: /opt/classmate/data/lesson.db',
    '읽기 실패: `/home/learner/private.txt`',
    '읽기 실패: </home/learner/private.txt>',
    '읽기 실패: {/home/learner/private.txt}',
    '읽기 실패:경로/home/learner/private.txt',
    '공유 주소 https://tiro.ooo/ko/s/example-share-id',
    '공유 주소 https://user@tiro.ooo.:443/ko/s/example-share-id',
    '공유 주소 https%3A%2F%2Ftiro.ooo%2Fko%2Fs%2Fexample-share-id',
    '공유 주소 https%253A%252F%252Ftiro.ooo%252Fko%252Fs%252Fexample-share-id',
    '이동 https://example.test/?next=https://tiro.ooo/ko/s/example-share-id',
    '이동 https://example.test/?next=https%3A%2F%2Ftiro.ooo%2Fko%2Fs%2Fexample-share-id',
    '이동 https%253A%252F%252Ftiro.ooo%252Fko%252Fs%252Fexample-share-id %ZZ',
    '주소 https://learner:example-secret@example.test/private',
    '주소 https://example.test/result?access_token=example-secret&view=1',
    '주소 https://example.test/result?code=example-secret',
    '주소 https://example.test/result?access%5Ftoken=example-secret',
  ])('민감한 원문 전체를 고정 문구로 바꿉니다: %s', (value) => {
    expect(sanitizeHistoryDisplayText(value)).toBe(HIDDEN_SENSITIVE_HISTORY_TEXT);
  });

  it('일반 문장과 비밀값 없는 URL은 그대로 둡니다', () => {
    expect(sanitizeHistoryDisplayText('화면 근거 파일 하나를 찾지 못했어요.')).toBe(
      '화면 근거 파일 하나를 찾지 못했어요.',
    );
    expect(sanitizeHistoryDisplayText('공식 근거 https://example.test/rule?page=2')).toBe(
      '공식 근거 https://example.test/rule?page=2',
    );
    for (const ordinary of [
      'Java / Spring',
      '입력 / 출력',
      '정규식 \\n은 줄바꿈입니다',
      'Java escape \\d+는 숫자입니다',
      '공식 근거 https://example.test/rule?page=2',
      'https://example.test/?zipcode=12345',
      'https://example.test/?decode=true',
      'https://example.test/?tokenizer=java',
      'https://example.test/?secretary=kim',
      'https://example.test/?product_code=A1',
      'https://example.test/?authorship=me',
    ]) {
      expect(sanitizeHistoryDisplayText(ordinary), ordinary).toBe(ordinary);
    }
  });

  it('목록도 원래 순서를 보존해 한 줄씩 검사합니다', () => {
    expect(sanitizeHistoryDisplayTexts(['정상 경고', 'path=/home/learner/private'])).toEqual([
      '정상 경고',
      HIDDEN_SENSITIVE_HISTORY_TEXT,
    ]);
  });

  it('병적인 percent 중첩은 작은 회차 상한에서 원문을 내보내지 않습니다', () => {
    const deeplyEncoded = `%${'25'.repeat(8191)}`;
    expect(deeplyEncoded).toHaveLength(16_383);
    expect(sanitizeHistoryDisplayText(deeplyEncoded)).toBe(HIDDEN_SENSITIVE_HISTORY_TEXT);
  });
});
