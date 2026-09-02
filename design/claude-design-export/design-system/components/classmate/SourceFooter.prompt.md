The quiet status line at the bottom of every screen: freshness of 전사 / Meet / IntelliJ and the 기록 count. Replaces cards and banners for status.

```jsx
<SourceFooter sources={[{key:'tiro',ago:'4초 전'},{key:'meet',ago:'2초 전'},{key:'intellij',ago:'1초 전'}]} count={1} onCount={openHistory} />
<SourceFooter count={1} warn={{ title:'전사가 잠시 멈췄어요.', description:'화면과 코드는 계속 기록하고 있어요.', action:'다시 연결', onAction }} />
<SourceFooter warn={{ tone:'off', title:'튜터 답변이 잠시 멈췄어요.', description:'수업 기록과 질문 지점은 계속 저장하고 있어요.' }} />
```
