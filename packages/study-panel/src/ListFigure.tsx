type Cell = string | number | boolean | null;
interface Frame {cells: Cell[]; label?: string; variable?: string; highlight?: number[]; slice?: {start: number; end: number}; negativeIndex?: boolean}
interface Figure {caption?: string; frames: Frame[]}
const cellText = (cell: Cell) => cell === null ? 'None' : cell === true ? 'True' : cell === false ? 'False' : String(cell);
const bounded = (text: unknown, size: number) => text === undefined || typeof text === 'string' && [...text].length <= size;

function parseFigure(raw: string): Figure | undefined {
  if (raw.length > 12000) return;
  let figure;
  try { figure = JSON.parse(raw); } catch { return; }
  if (figure?.template !== 'list-cells' || !bounded(figure.caption, 80) || !Array.isArray(figure.frames) || !figure.frames.length || figure.frames.length > 3) return;
  for (const frame of figure.frames) {
    if (!Array.isArray(frame?.cells) || frame.cells.length > 12 || !bounded(frame.label, 40) ||
        frame.variable !== undefined && (typeof frame.variable !== 'string' || !/^[A-Za-z_]\w{0,19}$/.test(frame.variable)) ||
        frame.negativeIndex !== undefined && typeof frame.negativeIndex !== 'boolean') return;
    if (frame.cells.some((cell: unknown) => ![null, 'string', 'number', 'boolean'].includes(cell === null ? null : typeof cell) ||
        typeof cell === 'number' && !Number.isFinite(cell) || [...cellText(cell as Cell)].length > 12)) return;
    const limit = frame.cells.length;
    const index = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= limit;
    if (frame.highlight !== undefined && (!Array.isArray(frame.highlight) || frame.highlight.length > 12 ||
        new Set(frame.highlight).size !== frame.highlight.length || frame.highlight.some((n: number) => !index(n) || n === limit))) return;
    if (frame.slice !== undefined && (!frame.slice || !index(frame.slice.start) || !index(frame.slice.end) || frame.slice.start > frame.slice.end)) return;
  }
  return figure;
}

export function ListFigure({raw}: {raw: string}) {
  const figure = parseFigure(raw);
  return <figure className="local-list-figure">
    {figure ? <>
      <figcaption>{figure.caption || '리스트 칸 그림'}</figcaption>
      <div className="list-figure-scroll" role="region" aria-label="리스트 칸 그림" tabIndex={0}>
        {figure.frames.map((frame, i) => <div key={i}>
          {frame.label && <p>{frame.label}</p>}
          <div className="list-frame">
            {frame.variable && <code>{frame.variable} =</code>}
            {frame.cells.length ? <ol>{frame.cells.map((cell, index) => {
              const highlight = frame.highlight?.includes(index);
              const sliced = frame.slice && index >= frame.slice.start && index < frame.slice.end;
              return <li key={index} className={highlight ? 'list-highlight' : sliced ? 'list-slice' : ''}
                aria-label={`번호 ${index}${highlight ? ' 강조' : ''}${sliced ? ' 자르기 범위' : ''}`}>
                <small>{index}</small><code>{cellText(cell)}</code>{frame.negativeIndex && <small>{index - frame.cells.length}</small>}
              </li>;
            })}</ol> : <code>[]</code>}
          </div>
          {frame.slice && <p>자르기 <code>[{frame.slice.start}:{frame.slice.end}]</code></p>}
        </div>)}
      </div>
    </> : <p role="status">리스트 칸 그림을 그리지 못했어요.</p>}
    <details><summary>그림 원문 보기</summary><pre>{raw}</pre></details>
  </figure>;
}
