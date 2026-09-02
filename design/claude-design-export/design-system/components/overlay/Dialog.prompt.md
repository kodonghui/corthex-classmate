Bottom sheet dialog for the rare confirmations (delete history, stop recording).

```jsx
<Dialog open={o} onClose={()=>setO(false)} title="기록을 지울까요" description="저장한 12개 순간이 사라져요." primaryAction="지우기" primaryVariant="danger" onPrimary={...} />
<Dialog open position="center" title="새 교시를 시작할까요" primaryAction="4교시 시작" secondaryAction="나중에" onClose={...} onPrimary={...} />
```

The scrim is absolute inside a `position:relative` panel; pass `fixed` for full-page use.
