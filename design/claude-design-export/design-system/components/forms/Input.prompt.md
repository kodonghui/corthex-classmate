Text field for the rare typed follow-up; keep placeholders inviting and short since learners may not know what to ask.

```jsx
<Input placeholder="짧게 물어봐도 돼요" icon="message-circle" trailing={<IconButton icon="arrow-up" label="보내기" size="sm" />} />
<Input label="이름" hint="수업 기록에 표시돼요" />
<Input invalid hint="비어 있어요" />
```

Props: label, hint, icon (leading), trailing (slot), size md 36 / lg 44, invalid (red border + red hint). Never make the input the primary action on the answer screen — chips come first.
