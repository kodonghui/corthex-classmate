Shows what is being recorded from Tiro, Meet and IntelliJ; list form with details or a compact row for headers.

```jsx
<SourceStatus sources={[
  {key:'tiro', state:'paused', detail:'마지막 전사 14:02', action:'다시 연결'},
  {key:'meet', state:'live', detail:'공유 화면 캡처 중'},
  {key:'intellij', state:'live', detail:'Main.java'},
]} onAction={reconnect} />
<SourceStatus compact />
```
