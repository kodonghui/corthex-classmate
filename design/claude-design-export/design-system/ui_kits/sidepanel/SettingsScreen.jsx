// 설정 — only what the product needs. Plain rows with hairlines; no cards.
(() => {
const { PanelHeader, RadioGroup, Checkbox, Switch, Button, Dialog, Select } = window.CorthexClassmateDesignSystem_a7a453 || {};

function SettingsScreen({ onBack, onClear, count }) {
  const [len, setLen] = React.useState('short');
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} title="설정" strong />
      <div className="cm-screen__body cm-screen__body--flush">
        <section className="cm-set"><div className="cm-set__h">답변</div>
          <RadioGroup name="len" value={len} onChange={setLen} options={[{ value: 'short', label: '한 줄만 먼저', description: '자세한 내용은 눌러서 봐요' }, { value: 'full', label: '바로 자세히', description: '근거와 코드까지 처음부터 펼쳐요' }]} />
          <Switch label="18초 뒤 자동으로 접기" description="끄면 직접 접을 때까지 남아요" defaultChecked style={{ width: '100%', marginTop: 4 }} />
        </section>
        <section className="cm-set"><div className="cm-set__h">붙잡을 때 함께 저장</div>
          <Checkbox label="전사" description="막힌 시점의 최근 30초" defaultChecked />
          <Checkbox label="Meet 화면" description="선생님 공유 화면 한 장" defaultChecked />
          <Checkbox label="IntelliJ 코드" description="지금 보고 있는 파일" defaultChecked />
        </section>
        <section className="cm-set"><div className="cm-set__h">수업</div>
          <Select label="지금 교시" options={['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시']} defaultValue="3교시" />
          <Switch label="단축키 Alt+S" description="마지막 문장을 붙잡아요" defaultChecked style={{ width: '100%' }} />
        </section>
        <section className="cm-set"><Button variant="danger" size="sm" icon="trash-2" onClick={() => setConfirm(true)}>오늘 기록 지우기</Button></section>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="오늘 기록을 지울까요" description={`붙잡은 ${count}개 순간이 사라져요. 되돌릴 수 없어요.`} primaryAction="지우기" primaryVariant="danger" onPrimary={() => { setConfirm(false); onClear(); }} />
    </div>
  );
}
window.SettingsScreen = SettingsScreen;
})();
