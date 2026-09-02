import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// CSS 적재 순서가 곧 의존 순서입니다(TASKS "사이드패널 CSS 적재 순서").
//   1. design-tokens  — CSS 변수(색·간격·글꼴·모션) 정의. fonts.css 가 npm 폰트를 @import 합니다.
//   2. ui-base        — 기본 요소 21종의 클래스. 변수만 참조합니다.
//   3. ui-classmate   — Classmate 10종의 클래스. base 요소 클래스를 씁니다.
//   4. 이 화면의 레이아웃(style.css).
import '@classmate/design-tokens/styles.css';
import '@classmate/ui-base/styles.css';
import '@classmate/ui-classmate/styles.css';
import './style.css';

import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('사이드패널의 root 요소를 찾지 못했어요');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
