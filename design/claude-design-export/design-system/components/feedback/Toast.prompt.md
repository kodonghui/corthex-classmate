Transient confirmation at the bottom of the panel; one line, auto-dismiss.

```jsx
<ToastHost>{saved && <Toast icon="bookmark" message="저장했어요 · 설명을 준비하고 있어요" action="보기" onAction={...} onClose={() => setSaved(false)} />}</ToastHost>
<Toast tone="light" icon="circle-check" live message="Tiro가 다시 연결됐어요" />
```
