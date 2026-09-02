// installer/windows 의 스크립트 넷이 함께 쓰는 자리 이름들입니다.
//
// 자리를 한곳에 모아 둔 이유는 하나입니다. `dist/` 안의 이름(실행 파일 · 매니페스트 · zip 두 벌)이
// `docs/first-class.md` 의 설치 절차와 글자 그대로 같아야 하는데, 스크립트마다 따로 적어 두면
// 한쪽만 고치는 사고가 납니다. 그래서 이름은 여기에만 적고 나머지는 이 파일을 읽습니다.
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 폴더도 만들지 않습니다
// (`ensureDist()` 를 부른 자리에서만 만듭니다).

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** installer/windows 폴더입니다. */
export const installerDir = here;

/** 저장소 루트입니다(installer/windows 에서 두 단계 위). */
export const repoRoot = resolve(here, '..', '..');

/** 만들어진 것을 모아 두는 자리입니다. .gitignore 에 있어 커밋되지 않습니다. */
export const distDir = join(here, 'dist');

/** 로컬 도우미 실행 파일 이름입니다. Windows 전용이라 하나뿐입니다. */
export const EXE_NAME = 'classmate-host.exe';

/** Native Messaging 호스트 이름입니다(register-host.mjs 의 HOST_NAME 과 같은 값). */
export const HOST_NAME = 'com.corthex.classmate';

/** dist 에 놓이는 실행 파일 경로입니다. install.mjs 가 매니페스트에 적는 값입니다. */
export const distExePath = join(distDir, EXE_NAME);

/** dist 에 놓이는 Native Messaging 매니페스트 경로입니다. */
export const distManifestPath = join(distDir, `${HOST_NAME}.json`);

/** 개발용 고정 확장 id 를 담아 두는 파일입니다. 공개키와 id 만 들어갑니다(비밀키 없음). */
export const keyFilePath = join(here, 'extension-key.json');

/** 확장 zip 두 벌의 이름입니다. dev 는 고정 id 용(key 포함), store 는 웹스토어 제출용입니다. */
export const DEV_ZIP_NAME = 'classmate-extension-dev.zip';
export const STORE_ZIP_NAME = 'classmate-extension-store.zip';

/** dist 폴더를 만듭니다. 이미 있으면 아무 일도 하지 않습니다. */
export function ensureDist() {
  mkdirSync(distDir, { recursive: true });
  return distDir;
}

/**
 * 경로의 구분자를 슬래시 하나로 맞춰 보여 줍니다.
 *
 * Windows 는 역슬래시를 쓰는데 문서와 명령은 슬래시로 적혀 있어, 화면에 섞여 나오면
 * 같은 자리인지 눈으로 알아보기 어렵습니다. 보여 줄 때만 씁니다 — 실제 파일 조작은
 * 그대로 원래 경로로 합니다.
 */
export function toPosix(path) {
  return path.split(sep).join('/');
}
