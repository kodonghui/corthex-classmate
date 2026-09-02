Answer to a stuck moment: one-sentence conclusion first, evidence tags, then collapsed sections and quick follow-ups.

```jsx
<AnswerCard topic="static" period="3교시" time="14:02"
  conclusion={<><code>static</code>은 객체를 만들지 않고 클래스에서 바로 쓰는 멤버예요.</>}
  evidence={[{type:'verified', source:'tiro', time:'14:02'}, {type:'inferred', reason:'코드에 생성자가 없어서'}]}
  sections={[
    {id:'why', label:'왜 그런가요', content:'…'},
    {id:'code', label:'코드로 보기', icon:'code-xml', type:'code', code:src, caption:'IntelliJ · Main.java', highlightLines:[3]},
    {id:'said', label:'선생님이 말한 부분', type:'quote', content:'여기서 new를 안 쓰는 이유는…', time:'14:01'},
  ]}
  followUps={[{id:'easier', label:'더 쉽게', icon:'minimize-2'}, {id:'example', label:'예시 더', icon:'list'}]}
  onFollowUp={ask} />
<AnswerCard loading conclusion="" />
```

Keep the conclusion under 40 Korean characters. Sections start closed; the learner opens them. Follow-ups are chips, never a text field.
