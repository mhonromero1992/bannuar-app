import {existsSync, readFileSync} from 'fs';
import path from 'path';
import * as labels from '../src/config/labels';

/** The label maps in the portal's src/lib/labels.ts, read from its text. */
function portalMaps(source: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of source.matchAll(/export const (\w+): [^=]+ = (\{[\s\S]*?\});/g)) {
    // eslint-disable-next-line no-new-func
    out[m[1]] = new Function(`return ${m[2]}`)();
  }
  return out;
}

const SHARED = ['EMPLOYEE_STATUS', 'EMPLOYMENT_TYPE', 'LEAVE_STATUS', 'COE_STATUS', 'COE_PURPOSE', 'REQUEST_STATUS', 'CONCERN_STATUS', 'CONCERN_CATEGORY', 'DOC_STATUS', 'ANN_PRIORITY', 'ANN_CATEGORY', 'ATTENDANCE_KIND', 'LOCATION_CHECK', 'ATTENDANCE_SOURCE', 'CASE_STATUS', 'CASE_DECISION'];
const sources = [
  path.join(__dirname, 'fixtures/portal-labels.ts.txt'),
  // the portal itself when it is checked out next to the app (npm run sync:portal copies it)
  path.join(__dirname, '../../bannuar-portal/src/lib/labels.ts'),
].filter(existsSync);

describe('status wording is the portal\'s, so HR and guards read the same words', () => {
  it('has at least the synced copy to compare with', () => {
    expect(sources.length).toBeGreaterThan(0);
  });
  it.each(sources)('matches %s', file => {
    const portal = portalMaps(readFileSync(file, 'utf8'));
    for (const name of SHARED) {
      expect({[name]: (labels as Record<string, unknown>)[name]}).toEqual({[name]: portal[name]});
    }
  });
  it('label() and tone() read the maps', () => {
    expect(labels.label(labels.LEAVE_STATUS, 'pending_supervisor')).toBe('With the commander');
    expect(labels.tone(labels.LEAVE_STATUS, 'approved')).toBe('ok');
    expect(labels.label(labels.COE_PURPOSE, 'bank_loan')).toBe('Bank or loan');
    expect(labels.label(labels.COE_PURPOSE, 'unknown')).toBe('unknown');
  });
});
