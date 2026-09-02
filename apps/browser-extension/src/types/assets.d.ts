// Vite 의 `?raw` 가져오기(파일 내용을 문자열로 받기)를 타입 검사에 알립니다.
//
// `wxt/vite-builder-env` 가 vite/client 의 `*?raw` 선언을 끌어오지만, fixtures 의
// `.jsonl` 파일을 가리키는 자리를 이 파일이 한 번 더 못 박아 두어 vitest 와 tsc 어느
// 쪽에서도 문자열로 풀리게 합니다. 실행 코드는 없습니다.
declare module "*.jsonl?raw" {
  const text: string;
  export default text;
}
