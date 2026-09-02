Radio / RadioGroup for one-of choices such as answer length.

```jsx
<RadioGroup name="len" value={v} onChange={setV} options={[
  {value:'short', label:'짧게', description:'한 문장 결론만'},
  {value:'full', label:'자세히', description:'근거와 코드까지'},
]} />
```

`direction="row"` lays options horizontally.
