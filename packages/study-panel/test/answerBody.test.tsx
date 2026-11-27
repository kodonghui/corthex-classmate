import React from 'react';
import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {AnswerBody} from '../src/AnswerBody';

afterEach(cleanup);

it.each([
  ['bare URL', 'https://example.com/guide', 'https://example.com/guide'],
  ['bare email', 'student@example.com', 'student@example.com'],
  ['URL link label', '[https://example.com](https://example.com/guide)', 'https://example.com'],
])('renders a %s without recursive parsing', (_name, text, visible) => {
  const {container} = render(<AnswerBody text={text}/>);
  expect(container.textContent).toContain(visible);
  expect(container.querySelectorAll('.answer-body')).toHaveLength(1);
});

it('preserves nested formatting in link labels and handles repeated links', () => {
  const {container} = render(<AnswerBody text={'[**중요** *설명* ~~이전~~](https://example.com)과 https://example.com/next'}/>);
  expect(container.querySelector('strong')?.textContent).toBe('중요');
  expect(container.querySelector('em')?.textContent).toBe('설명');
  expect(container.querySelector('del')?.textContent).toBe('이전');
  expect(container.textContent).toContain('https://example.com/next');
});

it('keeps external media and generated HTML inert alongside links', () => {
  const {container} = render(<AnswerBody text={'https://example.com\n\n![그림](https://example.com/image.png)\n\n<img src="https://example.com/remote.png" onerror="alert(1)">\n\n표시<br>다음 줄'}/>);
  expect(container.querySelector('a, img, script')).toBeNull();
  expect(container.textContent).toContain('[이미지: 그림]');
  expect(container.querySelector('br')).not.toBeNull();
});

it('removes every legacy grounding marker from prose and keeps Markdown and literal code', () => {
  const text = [
    '### 제목 [[수업#12]]',
    '**강조한 설명** [[보탬]]과 *이어지는 설명* [[장면]]',
    '1. 목록 본문 [[확인]]\n2. 상태 문구는 확인 필요',
    '> 인용 본문 [[수업#1]]',
    '| 예제 | 설명 |\n|---|---|\n| 표 안에서도 [[보탬]] | 본문 유지 |',
    '인라인 코드: `[[수업#1]]`',
    '```text\n[[보탬]]\n[[확인]]\n[[장면]]\n```',
    '[[보탬]] [[확인]]',
  ].join('\n\n');
  const {container} = render(<AnswerBody text={text}/>);
  expect(container.querySelector('h3')?.textContent?.trim()).toBe('제목');
  expect(container.querySelector('strong')?.textContent).toBe('강조한 설명');
  expect(container.querySelector('em')?.textContent).toBe('이어지는 설명');
  expect(container.querySelector('li')?.textContent?.trim()).toBe('목록 본문');
  expect(container.querySelector('blockquote')?.textContent?.trim()).toBe('인용 본문');
  expect(container.querySelector('td')?.textContent?.trim()).toBe('표 안에서도');
  expect(container.querySelector('p code')?.textContent).toBe('[[수업#1]]');
  expect(container.querySelector('pre code')?.textContent).toBe('[[보탬]]\n[[확인]]\n[[장면]]');
  expect(container.querySelectorAll('p')).toHaveLength(2);
  const renderedProse=container.cloneNode(true) as HTMLElement;
  renderedProse.querySelectorAll('code').forEach(code=>code.remove());
  expect(renderedProse.textContent).toContain('상태 문구는 확인 필요');
  expect(renderedProse.textContent).not.toMatch(/\[\[(?:수업#\d+|장면|보탬|확인)\]\]/);
  expect(renderedProse.querySelector('.answer-grounding')).toBeNull();
});

it('keeps streaming code and hides unfinished grounding markers until the answer ends', () => {
  const {container,rerender}=render(<AnswerBody text={'실행 코드 `[[확인]]` 그대로 [[수업#12]'} streaming/>);
  expect(container.querySelector('code')?.textContent).toBe('[[확인]]');
  expect(container.querySelector('p')?.textContent).not.toContain('[[수업#');
  rerender(<AnswerBody text={'일반 텍스트 [[확'} streaming/>);
  expect(container.textContent?.trim()).toBe('일반 텍스트');
  rerender(<AnswerBody text={'일반 텍스트 [[확'} />);
  expect(container.textContent).toBe('일반 텍스트 [[확');
});
