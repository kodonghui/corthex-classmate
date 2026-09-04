// 설정 화면 — 제품에 정말 필요한 것만. 카드 없이 헤어라인으로만 나눈 줄들입니다.
// 정본: design-system/ui_kits/sidepanel/SettingsScreen.jsx · Classmate Side Panel.dc.html:101-120.
//
// 정본과 다른 곳 세 군데(모두 의도한 것입니다):
//  1. "붙잡을 때 함께 저장" 바로 아래에 개인정보 세 칸을 답니다. 정본에는 없고 불변 원칙 §5 가 정한 문구입니다.
//  2. "답변" 절에 제공자 고르기를 더합니다. 정본에는 없고 2라운드 고정 계약(다)이 정한 값입니다.
//     codex 는 한도가 돌아오기 전까지 고를 수 없어 잠가 둡니다.
//  3. "글씨 크기" 절을 더합니다. 정본에는 없고 사용자가 청한 값입니다. 패널은 폭 320~400px 로 좁고
//     화면과 눈은 사람마다 달라서, 여기 있는 다른 잠긴 칸들과 달리 **지금 바로 듣는** 설정입니다.

import { Button, Checkbox, Dialog, Input, RadioGroup, Select, Switch, PanelHeader } from "@classmate/ui-base";
import { useState } from "react";

import { PERIOD_NUMBER_MAX, PERIOD_NUMBER_MIN } from "../../tiro/period";
import type { Settings } from "../settings-store";
import { PRIVACY_CELLS, subjectInput, TEXT_SCALE_STEPS, textScaleInput } from "../settings-store";

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

/*
  아직 읽는 곳이 없는 칸은 **끄고 그 까닭을 적습니다.** 켤 수 있는 것처럼 두면 사용자가
  "IntelliJ 코드 저장을 껐다" 고 믿는데 그대로 캡처·전송되는 일이 생깁니다(2라운드 검토 #4·#5·#7).
  배선이 오면 `disabled` 와 이 설명만 걷어 내면 됩니다.
*/
const NEXT_ROUND_NOTE = "다음 라운드에 켜져요";

const LENGTH_OPTIONS = [
  { value: "short", label: "한 줄만 먼저", description: "자세한 내용은 눌러서 봐요", disabled: true },
  { value: "full", label: "바로 자세히", description: "근거와 코드까지 처음부터 펼쳐요", disabled: true },
];

const PROVIDER_OPTIONS = [
  { value: "claude", label: "Claude", description: "지금 답을 만드는 곳이에요" },
  { value: "codex", label: "Codex", description: "한도 복구 뒤에 고를 수 있어요", disabled: true },
];

/*
  단계와 차례는 `settings-store` 의 `TEXT_SCALE_STEPS` 가 정합니다. 여기서는 그대로 라디오로 폅니다.
  설명(description)은 달지 않습니다 — 고른 결과가 그 자리에서 글씨로 보이므로 말이 필요 없고,
  네 줄에 설명까지 붙이면 좁은 패널에서 절 하나가 지나치게 길어집니다.
*/
const TEXT_SCALE_OPTIONS = TEXT_SCALE_STEPS.map((step) => ({ value: step.value, label: step.label }));

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
          <p className="cm-set__note">지금은 늘 한 줄만 먼저 보여 줘요 — 고르기는 {NEXT_ROUND_NOTE}</p>
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
          <div className="cm-set__h">글씨 크기</div>
          <RadioGroup
            name="text-scale"
            value={values.textScale}
            onChange={(value) => onChange("textScale", textScaleInput(value))}
            options={TEXT_SCALE_OPTIONS}
          />
          {/*
            이 절의 안내는 "다음 라운드" 가 아닙니다. 고른 순간 뿌리 요소에 이름표가 붙어
            (settings-store 의 withTextScaleApplied) 화면이 그 자리에서 바뀝니다.
          */}
          <p className="cm-set__note">고르면 그 자리에서 바뀌어요 — 전사와 답변 글씨가 함께 커져요</p>
        </section>

        <section className="cm-set">
          <div className="cm-set__h">붙잡을 때 함께 저장</div>
          <Checkbox
            label="전사"
            description="막힌 시점의 최근 30초"
            checked={values.captureTranscript}
            disabled
            onChange={(event) => onChange("captureTranscript", event.target.checked)}
          />
          <Checkbox
            label="수업 화면"
            description="영상 탭에서 고른 화면 한 장"
            checked={values.captureScreen}
            disabled
            onChange={(event) => onChange("captureScreen", event.target.checked)}
          />
          <Checkbox
            label="IntelliJ 코드"
            description="지금 보고 있는 파일"
            checked={values.captureEditor}
            disabled
            onChange={(event) => onChange("captureEditor", event.target.checked)}
          />
          <p className="cm-set__note">지금은 세 가지를 늘 함께 저장해요 — 골라 끄기는 {NEXT_ROUND_NOTE}</p>
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
            // 다 지운 채로 두면 저장소에는 "" 가 남고 읽을 때만 "수업" 으로 되살아나 다음에 열 때
            // 화면과 저장소가 어긋납니다. 칸을 떠날 때 빈 값을 기본값으로 맞춰 둘을 같게 합니다.
            onBlur={(event) => onChange("subject", subjectInput(event.target.value))}
          />
          <Switch
            label="단축키 Alt+S"
            description="마지막 문장을 붙잡아요"
            checked={values.altS}
            onChange={(event) => onChange("altS", event.target.checked)}
            style={{ width: "100%" }}
          />
          <p className="cm-set__note">교시와 주제는 패널을 다시 열 때부터 적용돼요</p>
        </section>

        <section className="cm-set">
          {/*
            지우기를 받아 줄 도우미(호스트) 봉투가 아직 없습니다. 눌러서 확인 창까지 뜨면
            "지웠다" 는 거짓 확인이 되므로 버튼째 끕니다(2라운드 검토 #5).
          */}
          <Button variant="danger" size="sm" icon="trash-2" disabled onClick={() => setConfirm(true)}>
            오늘 기록 지우기
          </Button>
          <p className="cm-set__note">아직 지울 수 없어요 — 도우미 삭제 기능은 {NEXT_ROUND_NOTE}</p>
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
