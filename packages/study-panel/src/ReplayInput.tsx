import {useRef,useState} from 'react';

export interface ReplayFile {name: string; items: unknown}
export function ReplayInput({value, speed, onFile, onSpeed}: {
  value?: ReplayFile; speed: number; onFile: (value?: ReplayFile) => void; onSpeed: (speed: number) => void;
}) {
  const [error, setError] = useState('');
  const selection = useRef(0);
  return <div className="learning-fields">
    <label>전사 JSON 파일<input aria-label="전사 JSON 파일" type="file" accept=".json,application/json" onChange={event => {
      const file = event.currentTarget.files?.[0];
      const revision = ++selection.current;
      onFile(undefined);
      setError('');
      if (!file) return;
      if (file.size > 5 * 1024 * 1024 - 1024) {setError('5MB 미만의 전사 JSON 파일을 골라 주세요.'); return;}
      void file.text().then(text => {
        const items: unknown = JSON.parse(text);
        if (!Array.isArray(items) || !items.length) throw Error('empty replay');
        if (revision === selection.current) onFile({name: file.name, items});
      }).catch(() => {if (revision === selection.current) setError('문단이 들어 있는 JSON 배열을 골라 주세요.');});
    }}/></label>
    {value && <small>{value.name}</small>}
    <label>재생 속도<select value={speed} onChange={event => onSpeed(Number(event.target.value))}>
      {[1,2,10].map(rate => <option key={rate} value={rate}>{rate}배</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
  </div>;
}
