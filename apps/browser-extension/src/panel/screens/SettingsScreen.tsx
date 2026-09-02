// 설정 화면 — 제품에 정말 필요한 것만. 카드 없이 헤어라인으로만 나눈 줄들입니다.
// 정본: design-system/ui_kits/sidepanel/SettingsScreen.jsx · Classmate Side Panel.dc.html:101-120.
//
// 정본과 다른 곳 두 군데(둘 다 의도한 것입니다):
//  1. "붙잡을 때 함께 저장" 바로 아래에 개인정보 세 칸을 답니다. 정본에는 없고 불변 원칙 §5 가 정한 문구입니다.
//  2. "답변" 절에 제공자 고르기를 더합니다. 정본에는 없고 2라운드 고정 계약(다)이 정한 값입니다.
//     codex 는 한도가 돌아오기 전까지 고를 수 없어 잠가 둡니다.

import { Button, Checkbox, Dialog, Input, RadioGroup, Select, Switch, PanelHeader } from "@classmate/ui-base";
import { useState } from "react";

import { PERIOD_NUMBER_MAX, PERIOD_NUMBER_MIN } from "../../tiro/period";
import type { Settings } from "../settings-store";
import { PRIVACY_CELLS } from "../settings-store";

export interface SettingsScreenProps {
  readonly values: Settings;
  /** 오늘 붙잡은 순간 수입니다. 지우기 확인 문구에 들어갑니다. */
  readonly count: number;
  readonly onBack: () => void;
  readonly onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  readonly onClearToday: () => void;
}

const PERIOD_OPTIONS = Array.from({ length: PERIOD_NUMBER_MAX - PERIOD_NUMBER_MIN + 1 }, (_, index) => {
  const number = PERIOD_NUMBER_MIN + index;
  return { value: String(number), label: `${number}교시` };
});

const LENGTH_OPTIONS = [
  { value: "short", label: "한 줄만 먼저", description: "자세한 내용은 눌러서 봐요" },
  { value: "full", label: "바로 자세히", description: "근거와 코드까지 처음부터 펼쳐요" },
];

const PROVIDER_OPTIONS = [
  { value: "claude", label: "Claude", description: "지금 답을 만드는 곳이에요" },
  { value: "codex", label: "Codex", description: "한도 복구 뒤에 고를 수 있어요", disabled: true },
];

export function SettingsScreen({ values, count, onBack, onChange, onClearToday }: SettingsScreenProps): React.JSX.Element {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title="설정" />
      <div className="cm-screen__body cm-screen__body--flush">
        <section className="cm-set">
          <div className="cm-set__h">답변</div>
          <RadioGroup
            name="answer-length"
            value={values.answerLength}
            onChange={(value) => onChange("answerLength", value === "full" ? "full" : "short")}
            options={LENGTH_OPTIONS}
          />
          <Switch
            label="18초 뒤 자동으로 접기"
            description="끄면 접히지 않고 그대로 남아요"
            checked={values.autoFold}
            onChange={(event) => onChange("autoFold", event.target.checked)}
            style={{ width: "100%" }}
          />
          <div className="cm-set__sub">답변을 만드는 곳</div>
          <RadioGroup
            name="provider"
            value={values.provider}
            onChange={(value) => onChange("provider", value === "codex" ? "codex" : "claude")}
            options={PROVIDER_OPTIONS}
          />
        </section>

        <section className="cm-set">
          <div className="cm-set__h">붙잡을 때 함께 저장</div>
          <Checkbox
            label="전사"
            description="막힌 시점의 최근 30초"
            checked={values.captureTranscript}
            onChange={(event) => onChange("captureTranscript", event.target.checked)}
          />
          <Checkbox
            label="Meet 화면"
            description="선생님 공유 화면 한 장"
            checked={values.captureScreen}
            onChange={(event) => onChange("captureScreen", event.target.checked)}
          />
          <Checkbox
            label="IntelliJ 코드"
            description="지금 보고 있는 파일"
            checked={values.captureEditor}
            onChange={(event) => onChange("captureEditor", event.target.checked)}
          />
          <p className="cm-set__privacy">
            {PRIVACY_CELLS.map((cell) => (
              <span key={cell} className="cm-set__privacy-cell">
                {cell}
              </span>
            ))}
          </p>
        </section>

        <section className="cm-set">
          <div className="cm-set__h">수업</div>
          <Select
            label="지금 교시"
            options={PERIOD_OPTIONS}
            value={String(values.periodNumber)}
            onChange={(event) => onChange("periodNumber", Number(event.target.value))}
          />
          <Input
            label="주제"
            value={values.subject}
            onChange={(event) => onChange("subject", event.target.value)}
          />
          <Switch
            label="단축키 Alt+S"
            description="마지막 문장을 붙잡아요"
            checked={values.altS}
            onChange={(event) => onChange("altS", event.target.checked)}
            style={{ width: "100%" }}
          />
        </section>

        <section className="cm-set">
          <Button variant="danger" size="sm" icon="trash-2" onClick={() => setConfirm(true)}>
            오늘 기록 지우기
          </Button>
        </section>
      </div>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="오늘 기록을 지울까요"
        description={`붙잡은 ${count}개 순간이 사라져요. 되돌릴 수 없어요.`}
        primaryAction="지우기"
        primaryVariant="danger"
        onPrimary={() => {
          setConfirm(false);
          onClearToday();
        }}
      />
    </div>
  );
}
