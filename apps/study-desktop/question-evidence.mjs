import {INSTRUCTIONS} from './tutor.mjs';

export const intents = {
  meaning: '선택한 문단이 무슨 뜻인지 먼저 한 줄로 답하세요.',
  example: '선택한 문단을 설명하는 짧은 예시 하나를 보여 주세요.',
  figure: 'Python 리스트 값, 인덱스, 자르기 설명에는 list-cells 그림을, 흐름과 역할 설명에는 Mermaid를 사용하세요.',
  trace: '코드를 한 줄씩 따라가며 각 단계의 값이 어떻게 바뀌는지 보여 주세요.',
};

export function questionInstructions(intent) {
  return INSTRUCTIONS + `
답변 첫 줄에 핵심 답을 쓰고 이어서 필요한 설명을 하세요. 전사와 수업 화면을 참고하세요. 필요하면 수업에서 확인한 내용, 일반 지식으로 보탠 내용, 불확실한 내용을 문장으로 구분하세요.
리스트는 list-cells 이름의 코드 블록에 다음 예와 같은 JSON을 쓸 수 있습니다.
{"template":"list-cells","caption":"리스트의 첫 값","frames":[{"label":"처음 상태","variable":"a","cells":[1,2,3],"highlight":[0],"slice":{"start":0,"end":2},"negativeIndex":true}]}
한 그림은 프레임 최대 3개, 프레임마다 셀 최대 12개입니다. 해당하지 않으면 기존 Mermaid 그림을 사용하세요.
${intent ? intents[intent] : ''}`;
}

export function numberedContext(context, current, id) {
  const index = current.paragraphs.findIndex(p => p.uuid === id);
  const source = id ? current.paragraphs.slice(Math.max(0, index - 2), index + 2) : current.paragraphs.slice(-3);
  const references = source.map(p => p.uuid);
  const numbered = (p, index) => ({...p, number: index + 1});
  if (id) {
    context.nearby = context.nearby.map(numbered);
    context.selected = numbered(context.selected, references.indexOf(id));
  } else context.recentLesson = context.recentLesson.map(numbered);
  return references;
}
