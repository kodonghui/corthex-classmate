/**
 * Gate B 실측 스파이크 — 브라우저에서 WebP 인코딩과 dHash 비용을 잽니다.
 *
 * 재는 것 (사람 없이 자동으로 되는 것만):
 *   (a) 1280x720 합성 장면 네 가지(code · slide · text · noise)를 **제품 코드의 인코더 클래스**
 *       `OffscreenWebpEncoder`(apps/browser-extension/src/capture/webp-encoder.ts)로 인코딩했을 때의
 *       **바이트 수 · 밀리초 · MIME**. 각 10회. text 가 실제 수업 화면에 가장 가깝고 noise 는 상한입니다.
 *       예전에는 여기서 `canvas.convertToBlob` 을 직접 불러 인코더 클래스가 **어떤 시험에서도
 *       실행되지 않았습니다**(검증자 지적 4). 지금은 dhash.ts 와 같은 방식으로 그 파일을 그대로
 *       브라우저에 넣어 진짜 클래스로 잽니다. 그래서 이 밀리초에는 인코더가 하는 복사
 *       (`putImageData`)까지 들어 있습니다. 실측해 보니 바이트는 예전과 똑같고 밀리초 차이는
 *       회차 사이 흔들림 안이었습니다(2026-09-02 실행). 복사가 공짜라는 뜻은 아니고,
 *       WebP 압축 자체가 훨씬 무거워 묻힌다는 뜻입니다.
 *   (b) apps/browser-extension/src/capture/dhash.ts 를 그대로 브라우저에 넣고 잰
 *       1280x720 한 장의 **dHash 밀리초**. 20회. (같은 파일을 Node 시험에서도 재므로
 *       두 환경 값을 나란히 볼 수 있습니다.)
 *   (c) 코드 화면 ↔ 슬라이드 화면, 코드 화면 ↔ 잡음만 얹은 코드 화면의 해밍 거리.
 *   (e) 인코더가 실제로 지키는지 두 가지: 1920x1080 을 넣으면 폭 1280 으로 줄이는가,
 *       나온 바이트가 진짜 WebP 인가(파일 앞 12바이트의 `RIFF`…`WEBP` 표시).
 *
 * 재지 못하는 것:
 *   실제 Meet 탭 `chrome.tabCapture` 는 **사용자 제스처**가 있어야 하고 확장을 사람이
 *   로드해야 합니다. Playwright 로 자동화할 수 없으므로 BLOCKED 로 두고 절차는
 *   docs/spikes/gate-b-meet.md 의 "사람이 할 일" 에 적습니다.
 *
 * 실행 (저장소 루트에서):
 *   node spikes/meet-capture-measure.mjs
 *
 * 결과는 화면에 찍고 spikes/out/gate-b/measure.json 에도 남깁니다. `out/` 은 .gitignore
 * 대상이라 커밋되지 않습니다. 이 스파이크는 실제 수업 화면을 열지 않고 지어낸 사각형만
 * 그립니다(불변 원칙 §4-3).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DHASH_PATH = resolve(REPO_ROOT, 'apps/browser-extension/src/capture/dhash.ts');
const WEBP_ENCODER_PATH = resolve(REPO_ROOT, 'apps/browser-extension/src/capture/webp-encoder.ts');
const OUT_DIR = resolve(HERE, 'out/gate-b');

const WIDTH = 1280;
const HEIGHT = 720;
/** 축소 경로를 확인할 때 쓰는 큰 화면. 인코더가 폭 1280 으로 줄여야 합니다. */
const BIG_WIDTH = 1920;
const BIG_HEIGHT = 1080;
const ENCODE_RUNS = 10;
const HASH_RUNS = 20;

/**
 * dhash.ts 를 브라우저가 읽을 수 있는 JS 로 바꿉니다.
 *
 * 원래 계획은 TypeScript 컴파일러 API(`ts.transpileModule`)였습니다. 이 저장소의
 * typescript 는 7.0.2(네이티브 포팅본)이고 패키지가 `tsc` 실행 파일과 버전 상수만
 * 내보내며 `transpileModule` 같은 JS API 를 노출하지 않습니다. 그래서 Node 24 가 기본으로
 * 들고 있는 `node:module` 의 타입 제거기를 씁니다. 하는 일은 같습니다(타입만 지우고
 * 실행 의미는 그대로).
 */
async function loadDhashAsJs() {
  const source = await readFile(DHASH_PATH, 'utf8');
  const stripped = stripTypeScriptTypes(source, { mode: 'strip' });
  return `${stripped}
globalThis.__dhash = { computeDHash, hammingDistance, toHex, isChanged, HASH_EPSILON, DEFAULT_CHANGE_THRESHOLD };
globalThis.__dhashReady = true;
`;
}

/**
 * webp-encoder.ts 를 같은 방법으로 브라우저에 넣습니다.
 *
 * 이 파일은 `import type` 두 줄만 들여오고(타입 제거기가 통째로 지웁니다) 나머지는
 * 브라우저 API(`OffscreenCanvas` · `ImageData`)뿐이라 그대로 페이지에서 돕니다.
 * 그래서 여기서 재는 바이트·밀리초가 **확장이 실제로 쓰는 코드의 값** 입니다.
 */
async function loadWebpEncoderAsJs() {
  const source = await readFile(WEBP_ENCODER_PATH, 'utf8');
  const stripped = stripTypeScriptTypes(source, { mode: 'strip' });
  return `${stripped}
globalThis.__webp = { OffscreenWebpEncoder, TARGET_WIDTH, WEBP_QUALITY, WEBP_MIME };
globalThis.__webpReady = true;
`;
}

/** 브라우저 안에서 돌 측정 본체입니다. 인자는 JSON 으로 넘어갑니다. */
async function measureInPage({ width, height, bigWidth, bigHeight, encodeRuns, hashRuns }) {
  const dhash = globalThis.__dhash;
  if (!dhash) {
    throw new Error('dhash 모듈이 주입되지 않았어요');
  }
  const webp = globalThis.__webp;
  if (!webp) {
    throw new Error('webp-encoder 모듈이 주입되지 않았어요');
  }

  /** 코드 화면을 흉내 낸 장면을 그립니다. 지어낸 사각형만 그립니다. */
  function drawCode(context, w, h, variant) {
    const patterns = [
      [0.55, 0.32, 0.71, 0.18, 0.62, 0.4, 0.25, 0.5],
      [0.2, 0.68, 0.35, 0.58, 0.14, 0.74, 0.46, 0.28],
    ];
    context.fillStyle = 'rgb(28,28,28)';
    context.fillRect(0, 0, w, h);
    context.fillStyle = 'rgb(210,210,210)';
    const pattern = patterns[variant % patterns.length];
    pattern.forEach((lineWidth, index) => {
      context.fillRect(0.06 * w, (0.08 + index * 0.11) * h, lineWidth * w, 0.05 * h);
    });
  }

  /** 슬라이드 화면을 흉내 낸 장면을 그립니다. */
  function drawSlide(context, w, h) {
    context.fillStyle = 'rgb(236,236,236)';
    context.fillRect(0, 0, w, h);
    context.fillStyle = 'rgb(30,30,30)';
    context.fillRect(0.08 * w, 0.12 * h, 0.62 * w, 0.14 * h);
    context.fillStyle = 'rgb(90,90,90)';
    context.fillRect(0.08 * w, 0.42 * h, 0.78 * w, 0.07 * h);
    context.fillRect(0.08 * w, 0.58 * h, 0.44 * w, 0.07 * h);
    context.fillStyle = 'rgb(150,150,150)';
    context.fillRect(0.62 * w, 0.72 * h, 0.3 * w, 0.18 * h);
  }

  /**
   * 글자가 빽빽한 화면을 흉내 냅니다. 실제 수업 화면(IDE·슬라이드 본문)은 이쪽에
   * 훨씬 가깝고, 위의 큰 사각형 장면보다 몇 배 무겁게 인코딩됩니다.
   */
  function drawText(context, w, h) {
    let state = 20260902;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    context.fillStyle = 'rgb(250,250,250)';
    context.fillRect(0, 0, w, h);
    const lineHeight = 18;
    for (let y = 24; y < h - 12; y += lineHeight) {
      let x = 40 + random() * 20;
      const lineEnd = 40 + (0.35 + random() * 0.6) * (w - 80);
      while (x < lineEnd) {
        const glyphWidth = 5 + random() * 9;
        const gray = 20 + Math.floor(random() * 90);
        context.fillStyle = `rgb(${gray},${gray},${gray})`;
        context.fillRect(x, y, glyphWidth, 11);
        x += glyphWidth + 3 + random() * 3;
      }
    }
  }

  /** 최악의 경우: 픽셀마다 무작위 색. 압축이 거의 되지 않습니다. */
  function drawNoiseScene(context, w, h) {
    const imageData = context.createImageData(w, h);
    let state = 12345;
    for (let i = 0; i < imageData.data.length; i += 4) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      imageData.data[i] = state & 0xff;
      imageData.data[i + 1] = (state >>> 8) & 0xff;
      imageData.data[i + 2] = (state >>> 16) & 0xff;
      imageData.data[i + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
  }

  /** 같은 그림에 결정적 잡음만 얹습니다. */
  function addNoise(imageData, amplitude, seed) {
    let state = seed >>> 0 || 1;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const delta = (state / 0x100000000) * 2 * amplitude - amplitude;
      data[i] = Math.max(0, Math.min(255, data[i] + delta));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
    }
    return imageData;
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const asRgba = (imageData) => ({
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  });

  const scenes = {};
  const encode = {};

  // 제품 코드의 인코더 클래스를 그대로 씁니다. 옵션을 주지 않았으므로 폭·품질은
  // webp-encoder.ts 안의 TARGET_WIDTH(1280) · WEBP_QUALITY(0.8) 를 그대로 따릅니다.
  // 확장이 실제로 그러듯 한 인스턴스를 계속 재사용합니다(캔버스·scratch 재사용 경로 포함).
  const encoder = new webp.OffscreenWebpEncoder();

  for (const name of ['code', 'slide', 'text', 'noise']) {
    if (name === 'code') drawCode(context, width, height, 0);
    else if (name === 'slide') drawSlide(context, width, height);
    else if (name === 'text') drawText(context, width, height);
    else drawNoiseScene(context, width, height);

    scenes[name] = context.getImageData(0, 0, width, height);
    const image = asRgba(scenes[name]);

    // 첫 회는 예열입니다(캔버스·scratch 를 여기서 처음 만듭니다).
    let encoded = await encoder.encode(image);
    const samples = [];
    for (let i = 0; i < encodeRuns; i += 1) {
      const startedAt = performance.now();
      encoded = await encoder.encode(image);
      samples.push(performance.now() - startedAt);
    }
    samples.sort((a, b) => a - b);
    encode[name] = {
      bytes: encoded.bytes,
      mime: encoded.mime,
      width: encoded.width,
      height: encoded.height,
      runs: encodeRuns,
      averageMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      minMs: samples[0],
      maxMs: samples[samples.length - 1],
      medianMs: samples[Math.floor(samples.length / 2)],
    };
  }

  // (e-1) 폭 상한. 1920x1080 을 넣으면 인코더가 폭 1280 으로 줄여야 합니다.
  const bigCanvas = new OffscreenCanvas(bigWidth, bigHeight);
  const bigContext = bigCanvas.getContext('2d', { willReadFrequently: true });
  drawText(bigContext, bigWidth, bigHeight);
  const bigImage = asRgba(bigContext.getImageData(0, 0, bigWidth, bigHeight));
  const downscaleEncoder = new webp.OffscreenWebpEncoder();
  const downscaled = await downscaleEncoder.encode(bigImage);

  // (e-2) 나온 바이트가 진짜 WebP 인지. WebP 는 `RIFF` 로 시작해 9~12바이트가 `WEBP` 입니다.
  const payloadEncoder = new webp.OffscreenWebpEncoder({ includePayload: true });
  const withPayload = await payloadEncoder.encode(asRgba(scenes.text));
  const tag = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

  const encoderCheck = {
    targetWidth: webp.TARGET_WIDTH,
    quality: webp.WEBP_QUALITY,
    mimeConstant: webp.WEBP_MIME,
    downscale: {
      inWidth: bigWidth,
      inHeight: bigHeight,
      outWidth: downscaled.width,
      outHeight: downscaled.height,
      bytes: downscaled.bytes,
      mime: downscaled.mime,
    },
    payload: {
      scene: 'text',
      bytes: withPayload.payload.byteLength,
      riff: tag(withPayload.payload, 0, 4),
      webp: tag(withPayload.payload, 8, 12),
    },
  };

  // 코드 화면을 다시 그려 두고 dHash 시간을 잽니다.
  drawCode(context, width, height, 0);
  const codeImage = context.getImageData(0, 0, width, height);

  dhash.computeDHash(asRgba(codeImage)); // 예열
  const hashSamples = [];
  for (let i = 0; i < hashRuns; i += 1) {
    const startedAt = performance.now();
    dhash.computeDHash(asRgba(codeImage));
    hashSamples.push(performance.now() - startedAt);
  }
  hashSamples.sort((a, b) => a - b);

  const codeHash = dhash.computeDHash(asRgba(codeImage));
  const slideHash = dhash.computeDHash(asRgba(scenes.slide));

  drawCode(context, width, height, 1);
  const codeVariantHash = dhash.computeDHash(asRgba(context.getImageData(0, 0, width, height)));

  const noisyDistances = {};
  for (const amplitude of [4, 8, 12, 20]) {
    const noisy = addNoise(
      new ImageData(new Uint8ClampedArray(codeImage.data), width, height),
      amplitude,
      20260902 + amplitude,
    );
    noisyDistances[amplitude] = dhash.hammingDistance(codeHash, dhash.computeDHash(asRgba(noisy)));
  }

  return {
    encode,
    encoderCheck,
    hash: {
      runs: hashRuns,
      averageMs: hashSamples.reduce((sum, value) => sum + value, 0) / hashSamples.length,
      minMs: hashSamples[0],
      maxMs: hashSamples[hashSamples.length - 1],
      medianMs: hashSamples[Math.floor(hashSamples.length / 2)],
    },
    distances: {
      codeVsSlide: dhash.hammingDistance(codeHash, slideHash),
      codeVsCodeVariant: dhash.hammingDistance(codeHash, codeVariantHash),
      codeVsNoise: noisyDistances,
    },
    hashes: {
      code: dhash.toHex(codeHash),
      slide: dhash.toHex(slideHash),
    },
    epsilon: dhash.HASH_EPSILON,
    defaultThreshold: dhash.DEFAULT_CHANGE_THRESHOLD,
  };
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

export async function main() {
  const dhashJs = await loadDhashAsJs();
  const webpJs = await loadWebpEncoderAsJs();

  const browser = await chromium.launch();
  let result;
  let version;
  try {
    version = browser.version();
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: dhashJs, type: 'module' });
    await page.addScriptTag({ content: webpJs, type: 'module' });
    await page.waitForFunction(
      () => globalThis.__dhashReady === true && globalThis.__webpReady === true,
      null,
      { timeout: 10_000 },
    );
    result = await page.evaluate(measureInPage, {
      width: WIDTH,
      height: HEIGHT,
      bigWidth: BIG_WIDTH,
      bigHeight: BIG_HEIGHT,
      encodeRuns: ENCODE_RUNS,
      hashRuns: HASH_RUNS,
    });
  } finally {
    await browser.close();
  }

  const measuredAt = new Date().toISOString();

  console.log('');
  console.log(`Gate B 실측 · ${measuredAt} · Chromium ${version} · ${WIDTH}x${HEIGHT}`);
  console.log('');
  console.log(
    `[a] WebP 인코딩 (제품 코드 OffscreenWebpEncoder · 폭 ${result.encoderCheck.targetWidth} · ` +
      `품질 ${result.encoderCheck.quality})`,
  );
  for (const [name, value] of Object.entries(result.encode)) {
    console.log(
      `    ${name.padEnd(6)} ${formatKiB(value.bytes).padStart(9)} (${value.bytes} B · ${value.mime} · ` +
        `${value.width}x${value.height}) · ` +
        `평균 ${formatMs(value.averageMs)} · 중앙 ${formatMs(value.medianMs)} · ` +
        `최소 ${formatMs(value.minMs)} · 최대 ${formatMs(value.maxMs)} · ${value.runs}회`,
    );
  }
  console.log('');
  console.log(`[b] dHash ${HASH_RUNS}회 (브라우저 · dhash.ts 그대로 주입)`);
  console.log(
    `    평균 ${formatMs(result.hash.averageMs)} · 중앙 ${formatMs(result.hash.medianMs)} · ` +
      `최소 ${formatMs(result.hash.minMs)} · 최대 ${formatMs(result.hash.maxMs)}`,
  );
  console.log('');
  console.log(`[c] 해밍 거리 (임계값 ${result.defaultThreshold} · 여유 ${result.epsilon})`);
  console.log(`    코드 ↔ 슬라이드      ${result.distances.codeVsSlide}`);
  console.log(`    코드 ↔ 코드(다른 배치) ${result.distances.codeVsCodeVariant}`);
  for (const [amplitude, distance] of Object.entries(result.distances.codeVsNoise)) {
    console.log(`    코드 ↔ 코드+잡음 ±${amplitude.padStart(2)}    ${distance}`);
  }
  console.log('');

  // 60분 메모리 예상: 분당 변화 횟수 x 한 장 바이트.
  // 실제 수업 화면에 가장 가까운 것은 '글자가 빽빽한' 장면이라 그것을 기준으로 잡고,
  // 최악의 경우(무작위 잡음)를 함께 적어 상한을 보입니다.
  const typicalBytes = result.encode.text.bytes;
  const worstBytes = result.encode.noise.bytes;
  console.log(
    `[d] 60분 프레임 메모리 예상 (보통 ${formatKiB(typicalBytes)}/장 · 최악 ${formatKiB(worstBytes)}/장)`,
  );
  const projection = {};
  for (const perMinute of [2, 6, 12, 30]) {
    const frames = perMinute * 60;
    const typicalTotal = frames * typicalBytes;
    const worstTotal = frames * worstBytes;
    projection[perMinute] = { frames, typicalBytes: typicalTotal, worstBytes: worstTotal };
    console.log(
      `    분당 ${String(perMinute).padStart(2)}회 변화 → ${String(frames).padStart(4)}장 · ` +
        `보통 ${(typicalTotal / (1024 * 1024)).toFixed(1)} MiB · ` +
        `최악 ${(worstTotal / (1024 * 1024)).toFixed(1)} MiB`,
    );
  }
  console.log('');

  const check = result.encoderCheck;
  console.log('[e] 인코더가 규칙을 지키는지');
  console.log(
    `    폭 상한   ${check.downscale.inWidth}x${check.downscale.inHeight} 넣음 → ` +
      `${check.downscale.outWidth}x${check.downscale.outHeight} 나옴 · ` +
      `${formatKiB(check.downscale.bytes)} · ${check.downscale.mime}`,
  );
  console.log(
    `    실제 바이트  앞 12바이트 "${check.payload.riff}"…"${check.payload.webp}" · ` +
      `${check.payload.bytes} B (text 장면 · includePayload)`,
  );
  console.log('');

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, 'measure.json');
  await writeFile(
    outPath,
    `${JSON.stringify({ measuredAt, chromium: version, width: WIDTH, height: HEIGHT, ...result, projection }, null, 2)}\n`,
    'utf8',
  );
  console.log(`결과를 ${outPath} 에 남겼습니다 (out/ 은 커밋되지 않습니다).`);
}

// 진입점 가드: 직접 실행할 때만 측정을 돌린다.
// 최상위에서 조건 없이 main() 을 부르면 import 한 번에 Chromium 이 뜨고 측정이 돌아간다.
// Gate C2 에서 같은 모양(provider-claude.mjs)이 import 부작용으로 실제 claude 5회를 돌려
// 승인 없이 1.251323 USD 가 나간 사고가 있었다(docs/spikes/gate-c2-provider.md 참조).
// 이쪽은 비용이 아니라 시간·프로세스 누수지만 같은 모양을 남기지 않는다.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
