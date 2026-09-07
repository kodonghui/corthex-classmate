/** Never echo native stderr, paths, credentials or prompts. */
export function providerFailureText(reason: string): string {
  switch (reason) {
    case "provider-unavailable": return "Claude Code 연결을 확인해 주세요. 위의 연결 점검에서 설치·로그인 상태를 확인할 수 있어요.";
    case "provider-spawn": return "Claude Code를 실행하지 못했어요. 설치 위치와 실행 권한을 확인해 주세요.";
    case "provider-auth": return "Claude Code 로그인이 필요해요. 공식 로그인 후 다시 질문해 주세요.";
    case "provider-limit": return "Claude 사용 한도에 도달했어요. 계정의 한도와 재개 시각을 확인해 주세요.";
    case "provider-timeout": case "timeout": return "답변이 제한 시간 안에 도착하지 않았어요. 연결 상태를 확인한 뒤 다시 질문할 수 있어요.";
    case "host-offline": case "disconnected": return "컴퓨터의 Classmate 도우미와 연결되지 않았어요. 연결 점검을 눌러 주세요.";
    case "provider-exit": return "Claude Code가 답변을 마치지 못했어요. 로그인·사용 한도·네트워크를 확인해 주세요.";
    case "provider-protocol": return "Claude의 응답을 읽지 못했어요. 연결 점검에서 버전을 확인해 주세요.";
    default: return "질문을 처리하지 못했어요. 연결 점검 후 다시 질문해 주세요.";
  }
}
