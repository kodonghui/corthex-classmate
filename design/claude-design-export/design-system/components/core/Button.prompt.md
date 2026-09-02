Action button; the only `primary` on a screen is the learner's next step, everything else is secondary or ghost.

```jsx
<Button variant="primary" size="lg" full icon="arrow-left">수업으로 돌아가기</Button>
<Button icon="refresh-cw">다시 연결</Button>
<Button variant="ghost" size="sm">예시 더</Button>
```

Variants: primary (ink-600, hover 700, pressed 800), secondary (paper card + strong border), ghost (text, paper-3 hover), danger (red text, only for destructive). Sizes sm 28 / md 36 / lg 44. `loading` swaps the leading icon for a slow spinner. Labels speak for the learner ("지금 막혔어요"), never "제출/전송".
