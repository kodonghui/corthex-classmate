The answer as a note in the margin of the transcript — one sentence first, evidence, two or three chips, "자세히 보기". It later folds to one dashed line.

```jsx
<MarginNote term="new" time="10:32:18" state="ready"
  conclusion="new 자체가 틀린 것은 아니지만, 객체를 바꾸거나 테스트하기 어려워져서 생성 책임을 분리해요."
  evidence={[{type:'verified',source:'tiro'},{type:'partial',source:'meet'},{type:'inferred',reason:'테스트 이야기'}]}
  chips={[{id:'easier',label:'더 쉽게'},{id:'why',label:'왜 필요한데?'},{id:'mine',label:'내 코드와 비교'}]} onChip={ask}
  onDetail={openDetail} collapseText="18초 뒤 접혀요 · 기록에 남아요" />
<MarginNote term="문장" time="10:32:18" state="choosing"><GuessList options={guesses} value={g} onChange={setG} /></MarginNote>
<MarginNote term="new" state="preparing"><SourceStatus compact sources={[{key:'tiro',state:'live',label:'전사 4초 전'},{key:'meet',state:'live',label:'Meet 2초 전'},{key:'intellij',state:'live',label:'OrderService.java 1초 전'}]} /></MarginNote>  {/* preparing: the three sealed sources first, then "한 줄로 정리하고 있어요" */}
<MarginNote term="new" time="10:32:18" state="collapsed" conclusion="…" onExpand={reopen} />
```
