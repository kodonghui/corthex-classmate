Expandable row that hides reasoning, code and sources until asked — the second half of "conclusion first".

```jsx
<Disclosure label="왜 그런가요" first>…</Disclosure>
<Disclosure label="코드로 보기" icon="code-xml"><CodeBlock code={src} /></Disclosure>
<Disclosure label="선생님이 말한 부분" meta="Tiro 14:02" open={o} onToggle={setO}>…</Disclosure>
```

Stack several; only the first gets `first` (no top hairline). Chevron rotates 180° in 180ms.
