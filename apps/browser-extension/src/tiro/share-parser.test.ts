// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { findParagraphElements, parseSharePage } from './share-parser';
import { isSharePageUrl, makePeriodId } from './index';

// 저장소가 들고 있는 합성 스냅샷입니다. 실제 공유 페이지가 아닙니다.
// `?raw` 는 Vite 가 파일을 문자열로 넣어 주는 방식입니다(vite/client 타입 포함).
import recordingHtml from '../../../../fixtures/tiro/share-page-recording.html?raw';
import brokenHtml from '../../../../fixtures/tiro/share-page-selector-broken.html?raw';
import noHintsHtml from '../../../../fixtures/tiro/share-page-no-class-hints.html?raw';
import markerDriftHtml from '../../../../fixtures/tiro/share-page-marker-drift.html?raw';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('findParagraphElements', () => {
  it('녹음 중 스냅샷에서 main 아래 문단 5개를 잡습니다', () => {
    const { elements, matchedSelector } = findParagraphElements(mount(recordingHtml));
    expect(elements).toHaveLength(5);
    expect(matchedSelector).toBe('main div.whitespace-pre-wrap');
  });

  it('클래스가 통째로 바뀌면 아무것도 못 잡고 선택자를 null 로 돌려줍니다', () => {
    const { elements, matchedSelector } = findParagraphElements(mount(brokenHtml));
    expect(elements).toHaveLength(0);
    expect(matchedSelector).toBeNull();
  });

  it('글자가 없는 껍데기 div 는 문단으로 세지 않습니다', () => {
    const root = mount(
      '<main><div class="whitespace-pre-wrap"> </div>' +
        '<div class="whitespace-pre-wrap">한 문장만 셉니다.</div></main>',
    );
    const { elements } = findParagraphElements(root);
    expect(elements).toHaveLength(1);
  });

  it('감싸는 div 가 같은 선택자에 걸려도 가장 안쪽 문단만 셉니다', () => {
    // 조상까지 세면 그 textContent 가 전사 전체를 이어 붙인 글자가 되고, 조상은 마지막이
    // 아니므로 구조 폴백에서 곧바로 final 이 되어 교시 전사 전체가 세그먼트 한 건으로
    // 나갑니다(확정은 취소가 안 됩니다).
    const root = mount(
      '<main><div class="whitespace-pre-wrap">' +
        '<div class="whitespace-pre-wrap font-medium">확정된 문장입니다.</div>' +
        '<div class="whitespace-pre-wrap font-semibold">쓰이는 중인 문장</div>' +
        '</div></main>',
    );
    const { elements, matchedSelector } = findParagraphElements(root);

    expect(matchedSelector).toBe('main div.whitespace-pre-wrap');
    expect(elements).toHaveLength(2);
    expect(elements.map((element) => element.textContent?.trim())).toEqual([
      '확정된 문장입니다.',
      '쓰이는 중인 문장',
    ]);
  });
});

describe('parseSharePage — 확정과 진행 중 구분', () => {
  it('font-semibold 가 붙은 마지막 문단만 진행 중으로 봅니다', () => {
    const result = parseSharePage(mount(recordingHtml));

    expect(result.selectorBroken).toBe(false);
    expect(result.stateSource).toBe('class');
    expect(result.paragraphs.map((p) => p.state)).toEqual([
      'final',
      'final',
      'final',
      'final',
      'in_progress',
    ]);
  });

  it('문단 번호는 0 부터 문서 순서대로 붙고 본문은 앞뒤 공백이 지워집니다', () => {
    const result = parseSharePage(mount(recordingHtml));

    expect(result.paragraphs[0]?.index).toBe(0);
    expect(result.paragraphs[0]?.text).toBe('자 그러면 지금까지 만든 주문 서비스를 다시 볼게요.');
    expect(result.paragraphs[4]?.index).toBe(4);
    expect(result.paragraphs[4]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션');
  });

  it('판별 근거로 쓴 클래스 목록을 그대로 남깁니다', () => {
    const result = parseSharePage(mount(recordingHtml));

    expect(result.paragraphs[4]?.classes).toContain('font-semibold');
    expect(result.paragraphs[0]?.classes).toContain('font-medium');
    expect(result.paragraphs[0]?.classes).toContain('text-tds-fg-subtle');
  });

  it('진행 중 문단이 하나도 없으면(녹음 멈춤) 전부 확정입니다', () => {
    const root = mount(recordingHtml);
    const last = root.querySelectorAll('div.whitespace-pre-wrap')[4];
    last?.setAttribute('class', 'whitespace-pre-wrap font-medium text-tds-fg-subtle leading-7');

    const result = parseSharePage(root);
    expect(result.paragraphs.every((p) => p.state === 'final')).toBe(true);
    // 확정 힌트만 보였습니다. 녹음이 멈춘 것인지 진행 힌트 이름이 바뀐 것인지 페이지만 보고는 모릅니다.
    expect(result.stateSource).toBe('class-partial');
  });
});

describe('parseSharePage — 클래스 힌트가 한 쪽만 남았을 때', () => {
  it('두 힌트가 모두 보일 때만 stateSource 가 class 입니다', () => {
    expect(parseSharePage(mount(recordingHtml)).stateSource).toBe('class');
  });

  it('확정 힌트만 남으면 class-partial 이고 마지막 문단은 확정으로 내보내지 않습니다', () => {
    const result = parseSharePage(mount(markerDriftHtml));

    expect(result.selectorBroken).toBe(false);
    expect(result.stateSource).toBe('class-partial');
    expect(result.paragraphs.map((p) => p.state)).toEqual([
      'final',
      'final',
      'final',
      'in_progress',
    ]);
    // 마지막 문단이 진행 중으로 남은 근거는 "확정 클래스가 없다" 하나뿐입니다.
    expect(result.paragraphs[3]?.classes).not.toContain('font-medium');
    expect(result.paragraphs[3]?.classes).not.toContain('font-semibold');
  });

  it('진행 힌트만 남아도 class-partial 이고 앞 문단은 구조 폴백으로 확정이 됩니다', () => {
    const result = parseSharePage(
      mount(
        '<main><div class="whitespace-pre-wrap leading-7">확정된 첫 문장입니다.</div>' +
          '<div class="whitespace-pre-wrap leading-7">확정된 둘째 문장입니다.</div>' +
          '<div class="whitespace-pre-wrap font-semibold leading-7">쓰이는 중인 문장</div></main>',
      ),
    );

    expect(result.stateSource).toBe('class-partial');
    expect(result.paragraphs.map((p) => p.state)).toEqual(['final', 'final', 'in_progress']);
  });
});

describe('parseSharePage — 마지막 문단은 확정 표시가 있을 때만 확정', () => {
  it('앞 문단에 진행 힌트가 남아 있어도 표시 없는 마지막 문단을 확정으로 만들지 않습니다', () => {
    // 앞 문단이 font-semibold 인 채로 마지막 문단만 표시가 빠진 배포를 흉내 냅니다.
    // 예전 규칙("진행 중 문단이 하나라도 있으면 나머지는 전부 확정")이면 여기서 마지막이 final 로 샙니다.
    const result = parseSharePage(
      mount(
        '<main><div class="whitespace-pre-wrap font-medium text-tds-fg-subtle leading-7">확정된 문장입니다.</div>' +
          '<div class="whitespace-pre-wrap font-semibold leading-7">아직 자라는 앞 문단</div>' +
          '<div class="whitespace-pre-wrap leading-7">표시가 없는 마지막 문단</div></main>',
      ),
    );

    expect(result.stateSource).toBe('class');
    expect(result.paragraphs.map((p) => p.state)).toEqual(['final', 'in_progress', 'in_progress']);
  });

  it('마지막 문단에 확정 표시가 명시적으로 있으면 확정입니다', () => {
    const result = parseSharePage(
      mount(
        '<main><div class="whitespace-pre-wrap font-semibold leading-7">아직 자라는 앞 문단</div>' +
          '<div class="whitespace-pre-wrap font-medium text-tds-fg-subtle leading-7">확정된 마지막 문단</div></main>',
      ),
    );

    expect(result.stateSource).toBe('class');
    expect(result.paragraphs.map((p) => p.state)).toEqual(['in_progress', 'final']);
  });
});

describe('parseSharePage — 폴백', () => {
  it('클래스 힌트가 사라지면 마지막 문단만 진행 중으로 보는 구조 폴백이 걸립니다', () => {
    const result = parseSharePage(mount(noHintsHtml));

    expect(result.selectorBroken).toBe(false);
    expect(result.stateSource).toBe('structure');
    expect(result.paragraphs.map((p) => p.state)).toEqual(['final', 'final', 'in_progress']);
  });

  it('main 밖으로 옮겨져도 넓은 선택자로 다시 잡습니다', () => {
    const root = mount(
      '<section><div class="whitespace-pre-wrap font-medium">확정된 문장입니다.</div>' +
        '<div class="whitespace-pre-wrap font-semibold">쓰이는 중인 문장</div></section>',
    );
    const result = parseSharePage(root);

    expect(result.matchedSelector).toBe('div.whitespace-pre-wrap');
    expect(result.paragraphs.map((p) => p.state)).toEqual(['final', 'in_progress']);
  });

  it('넓은 폴백 선택자에서도 감싸는 요소를 문단으로 세지 않습니다', () => {
    // `[class*="whitespace-pre-wrap"]` 는 가장 넓은 4번 선택자라 감싸는 껍데기가 함께
    // 걸리기 쉽습니다. 여기서 조상을 세면 전사 전체가 한 문단이 됩니다.
    const root = mount(
      '<section class="whitespace-pre-wrap-container">' +
        '<p class="whitespace-pre-wrap-line">확정된 문장입니다.</p>' +
        '<p class="whitespace-pre-wrap-line">쓰이는 중인 문장</p>' +
        '</section>',
    );
    const result = parseSharePage(root);

    expect(result.matchedSelector).toBe('[class*="whitespace-pre-wrap"]');
    expect(result.paragraphs.map((p) => p.text)).toEqual(['확정된 문장입니다.', '쓰이는 중인 문장']);
    expect(result.paragraphs.map((p) => p.state)).toEqual(['final', 'in_progress']);
  });
});

describe('parseSharePage — 선택자 깨짐 감지', () => {
  it('문단을 하나도 못 잡으면 selector_broken 신호를 냅니다', () => {
    const result = parseSharePage(mount(brokenHtml));

    expect(result.selectorBroken).toBe(true);
    expect(result.paragraphs).toHaveLength(0);
    expect(result.matchedSelector).toBeNull();
    expect(result.stateSource).toBe('none');
  });

  it('빈 문서도 선택자 깨짐으로 봅니다', () => {
    expect(parseSharePage(mount('')).selectorBroken).toBe(true);
  });
});

describe('isSharePageUrl', () => {
  it('로케일이 있든 없든 /s/<id> 모양이면 공유 페이지로 봅니다', () => {
    expect(isSharePageUrl('https://tiro.ooo/ko/s/abcdef')).toBe(true);
    expect(isSharePageUrl('https://tiro.ooo/s/abcdef')).toBe(true);
  });

  it('다른 tiro.ooo 페이지·다른 호스트·http 는 붙지 않습니다', () => {
    expect(isSharePageUrl('https://tiro.ooo/ko/settings')).toBe(false);
    expect(isSharePageUrl('https://tiro.ooo/ko/s/')).toBe(false);
    expect(isSharePageUrl('https://evil.example/ko/s/abcdef')).toBe(false);
    expect(isSharePageUrl('http://tiro.ooo/ko/s/abcdef')).toBe(false);
    expect(isSharePageUrl('주소가 아님')).toBe(false);
  });
});

describe('makePeriodId', () => {
  it('로컬 날짜와 교시 번호로 계약이 요구하는 모양을 만듭니다', () => {
    expect(makePeriodId(new Date(2026, 8, 2, 10, 32, 18), 3)).toBe('2026-09-02-p3');
    expect(makePeriodId(new Date(2026, 0, 5, 9, 0, 0), 12)).toBe('2026-01-05-p12');
  });

  it('0 교시나 소수는 막습니다', () => {
    expect(() => makePeriodId(new Date(), 0)).toThrow(RangeError);
    expect(() => makePeriodId(new Date(), 1.5)).toThrow(RangeError);
  });
});
