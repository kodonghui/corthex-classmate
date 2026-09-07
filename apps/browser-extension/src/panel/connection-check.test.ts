import { describe, expect, it } from 'vitest';
import { parseConnectionReport } from './connection-check';

describe('safe connection report', () => {
  it('drops credentials, personal fields, paths and unknown status', () => {
    expect(parseConnectionReport({ type: 'provider.status', state: 'ready', cliVersion: '2.1.252', email: 'private', token: 'secret', path: 'C:/private' }))
      .toEqual({ state: 'ready', cliVersion: '2.1.252' });
    expect(parseConnectionReport({ type: 'provider.status', state: 'private value' })).toEqual({ state: 'host-update-required' });
  });
  it('old native host response is not login success', () => {
    expect(parseConnectionReport({ type: 'error', reason: 'unsupported' })).toEqual({ state: 'host-update-required' });
    expect(parseConnectionReport(null)).toEqual({ state: 'host-update-required' });
  });
});
