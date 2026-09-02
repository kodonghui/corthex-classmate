The single hero action on the listening screen; press once to save the stuck moment.

```jsx
<StuckButton state={saving ? 'saving' : 'idle'} shortcut="Alt+S" onClick={save} />
<StuckButton state="saved" sublabel="설명을 준비하고 있어요" />
<StuckButton quiet sublabel="" />
```

Only one per screen, always full width, directly under the header. `quiet` for the answer screen where "수업으로 돌아가기" is primary.
