import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';

// 사이드패널 진입점. 화면 하나(듣는 중)만 붙입니다.
const container = document.getElementById('root');
if (!container) {
  throw new Error('사이드패널의 root 요소를 찾지 못했어요');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
