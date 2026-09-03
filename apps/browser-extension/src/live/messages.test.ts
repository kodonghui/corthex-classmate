/**
 * 통로 양쪽의 **문지기** 시험입니다.
 *
 * 이 두 함수가 느슨하면 모양이 깨진 말 하나가 스토어와 라우터 안쪽까지 들어가 거기서
 * 터집니다. 서비스 워커에서는 그 터짐이 처리되지 않은 약속 거부로 끝나 **질문이 조용히
 * 사라지고**, 패널에서는 `parseIso(undefined)` 로 시계가 망가집니다.
 */

import { describe, expect, it } from 'vitest';

import {
  LIVE_EVENT,
  LIVE_SEGMENT,
  PANEL_ASK,
  PANEL_EVENT,
  PANEL_RECONNECT,
  isLiveInboundMessage,
  isLiveOutboundMessage,
} from './messages';

const PERIOD = '2026-09-02-p3';

const event = {
  id: `ev-${PERIOD}-s1a2b3c4d-1`,
  periodId: PERIOD,
  at: '2026-09-02T10:32:00+09:00',
  type: 'period.started',
  payload: { periodId: PERIOD },
};

const askRequest = {
  questionId: 'q-p3-001',
  provider: 'claude',
  kind: 'missed',
  question: 'new 가 무슨 뜻인가요',
  snapshot: null,
};

describe('isLiveInboundMessage', () => {
  it('사건 다섯 칸이 갖춰진 live.event 를 받습니다', () => {
    expect(isLiveInboundMessage({ type: LIVE_EVENT, event })).toBe(true);
    expect(isLiveInboundMessage({ type: LIVE_SEGMENT, segment: { id: 'ts-1' } })).toBe(true);
  });

  it('빈 사건은 막습니다 (스토어가 #seen.add(undefined) 로 들어갑니다)', () => {
    expect(isLiveInboundMessage({ type: LIVE_EVENT, event: {} })).toBe(false);
    expect(isLiveInboundMessage({ type: LIVE_EVENT, event: { ...event, id: 7 } })).toBe(false);
    expect(isLiveInboundMessage({ type: LIVE_EVENT, event: { ...event, at: undefined } })).toBe(false);
    expect(isLiveInboundMessage({ type: LIVE_EVENT, event: { ...event, payload: '아님' } })).toBe(false);
    expect(isLiveInboundMessage({ type: LIVE_EVENT })).toBe(false);
  });
});

describe('isLiveOutboundMessage', () => {
  it('계약대로 채운 panel.ask 를 받습니다', () => {
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: askRequest })).toBe(true);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, word: 'new' } })).toBe(true);
    expect(isLiveOutboundMessage({ type: PANEL_EVENT, event })).toBe(true);
    expect(isLiveOutboundMessage({ type: PANEL_RECONNECT, connector: 'native-host' })).toBe(true);
  });

  it('질문 문장이 글자가 아니면 막습니다 (라우터가 question.length 에서 터집니다)', () => {
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, question: null } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, question: undefined } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, question: 42 } })).toBe(false);
  });

  it('질문 이름표·갈래·낱말이 글자가 아니면 막습니다', () => {
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, questionId: 1 } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, questionId: '' } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, kind: null } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: { ...askRequest, word: 3 } })).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_ASK, request: {} })).toBe(false);
  });

  it('모르는 낱말과 낯선 모양은 그냥 무시합니다', () => {
    expect(isLiveOutboundMessage({ type: 'panel.shout' })).toBe(false);
    expect(isLiveOutboundMessage(null)).toBe(false);
    expect(isLiveOutboundMessage({ type: PANEL_RECONNECT, connector: 'toaster' })).toBe(false);
  });
});
