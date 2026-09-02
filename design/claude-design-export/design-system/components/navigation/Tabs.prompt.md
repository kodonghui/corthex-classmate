Tabs for switching between views inside the panel (기록 filters, 답변/자료).

```jsx
<Tabs value={tab} onChange={setTab} items={[{id:'all',label:'전체',count:12},{id:'today',label:'오늘'},{id:'unread',label:'안 읽음',count:2}]} />
<Tabs variant="segmented" size="sm" value={v} onChange={setV} items={[{id:'short',label:'짧게'},{id:'full',label:'자세히'}]} />
```
