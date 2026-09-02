The teacher's last few sentences, large, newest at the bottom; tapping a dotted term or a sentence is how the learner says "I'm stuck" without typing.

```jsx
<TranscriptFlow lines={[
  { id:'l1', time:'10:32:00', segments:[{text:'객체를 직접 '},{text:'new',term:true},{text:'로 만들면 클래스끼리 '},{text:'강하게 묶입니다',term:true},{text:'.'}] },
  { id:'l2', time:'10:32:18', segments:[{text:'이제 '},{text:'생성 책임',term:true},{text:'을 '},{text:'컨테이너',term:true},{text:'에 맡겨 볼게요.'}] },
]} active={caught} onTerm={(lineId, idx, seg) => catchTerm(lineId, idx, seg.text)} onSentence={catchSentence}
  renderAfter={id => id === noteLine ? <MarginNote … /> : null} tip="걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요" />
```

Keep 3–5 lines visible. Only the last two are full ink. The note renders directly under its sentence via `renderAfter`.
