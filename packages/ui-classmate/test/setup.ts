// React 19 는 act 환경 밖에서 상태를 바꾸면 경고를 냅니다. 시험은 act 로 감싸므로 깃발을 세웁니다.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
