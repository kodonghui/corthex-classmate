Persistent inline banner for degraded states — say what stopped, what still records, and the one thing to do.

```jsx
<Banner tone="paused" title="Tiro 전사가 멈췄어요" description="Meet 화면과 코드는 계속 기록하고 있어요." action="다시 연결" onAction={...} onDismiss={...} />
<Banner tone="off" title="AI 연결을 기다리고 있어요" description="막힌 순간은 계속 저장돼요." />
<Banner tone="info" title="저장한 순간은 기록에서 볼 수 있어요" />
```

Amber (paused) is the default problem tone; red (off) only when nothing works. Never stack two banners.
