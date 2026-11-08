/**
 * A stand-in for Bannuar's Supabase project at https://mock.supabase.test (__mocks__/env.js): it
 * records every request the app makes and answers the way Supabase does. Like the portal's e2e mock
 * (bannuar-portal tests/e2e.mjs). __tests__/contract.test.ts checks the recorded requests against the
 * real schema. Requests to a real *.supabase.co host never get here: jest.setup.js refuses them.
 */
export interface Recorded {
  method: string;
  url: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

type Json = unknown;
type Answer = {status?: number; body?: Json; headers?: Record<string, string>} | Json;
type RpcHandler = (args: Record<string, unknown>) => Answer;

export const MOCK_URL = 'https://mock.supabase.test';
export const USER_ID = 'u-bea';
export const EMPLOYEE_ID = 'e-bea';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const jwt = (sub = USER_ID, extra: object = {}) =>
  `${b64({alg: 'HS256', typ: 'JWT'})}.${b64({
    sub,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'g-002@employees.bannuar.invalid',
    ...extra,
  })}.sig`;

export const user = (id = USER_ID) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'g-002@employees.bannuar.invalid',
  email_confirmed_at: '2026-11-01T00:00:00Z',
  user_metadata: {account_type: 'employee', employee_no: 'G-002'},
  app_metadata: {provider: 'email'},
  created_at: '2026-11-01T00:00:00Z',
});

export const session = (id = USER_ID) => ({
  access_token: jwt(id),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'refresh-1',
  user: user(id),
});

export const access = (over: Partial<Record<string, unknown>> = {}) => ({
  user_id: USER_ID,
  roles: ['employee'],
  full_name: 'Bea Lim',
  email: 'g-002@employees.bannuar.invalid',
  must_change_password: false,
  employee: {id: EMPLOYEE_ID, employee_no: 'G-002', full_name: 'Bea Lim', position: 'Lady Guard', status: 'active', site_id: 's1'},
  ...over,
});

export interface MockApi {
  requests: Recorded[];
  tables: Record<string, Json[]>;
  rpc: Record<string, RpcHandler>;
  /** The password the mock accepts at sign-in. */
  password: string;
  activate: (body: Record<string, unknown>) => Answer;
  /** Make every request fail as if the phone had no signal. */
  offline: boolean;
  rest: (method: string, table: string) => Recorded[];
  rpcCalls: (name: string) => Recorded[];
}

function answer(a: Answer, fallbackStatus = 200): Response {
  // {status: <number>, body?, headers?} sets the status; anything else is the JSON body itself
  const isWrapped = a !== null && typeof a === 'object' && !Array.isArray(a) && typeof (a as {status?: unknown}).status === 'number';
  const status = isWrapped ? (a as {status?: number}).status ?? fallbackStatus : fallbackStatus;
  const body = isWrapped ? (a as {body?: Json}).body : a;
  const headers = {'content-type': 'application/json', ...(isWrapped ? (a as {headers?: Record<string, string>}).headers ?? {} : {})};
  return new Response(body === undefined || status === 204 ? null : JSON.stringify(body), {status, headers});
}

function headerObject(h: RequestInit['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(h ?? {}).forEach((v: string, k: string) => {
    out[k] = v;
  });
  return out;
}

/** Filters GET rows by eq/in/is, the filters the app uses. */
function filterRows(rows: Json[], query: URLSearchParams): Json[] {
  let out = rows as Record<string, unknown>[];
  query.forEach((v, k) => {
    if (['select', 'order', 'limit', 'offset', 'or', 'on_conflict', 'columns'].includes(k)) {
      return;
    }
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    if (op === 'eq') {
      out = out.filter(r => String(r[k]) === val);
    } else if (op === 'neq') {
      out = out.filter(r => r[k] !== null && r[k] !== undefined && String(r[k]) !== val);
    } else if (op === 'in') {
      const set = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
      out = out.filter(r => set.includes(String(r[k])));
    } else if (op === 'is' && val === 'null') {
      out = out.filter(r => r[k] === null || r[k] === undefined);
    }
  });
  return out;
}

export function installMockApi(): MockApi {
  const api: MockApi = {
    requests: [],
    tables: {},
    rpc: {
      my_access: () => access(),
      mark_password_changed: () => null,
      mark_announcement_read: () => null,
      cancel_leave_request: () => null,
      cancel_coe_request: () => null,
      decide_leave_request: () => ({id: 'lr1', status: 'pending_hr'}),
      get_government_ids: () => [{sss_no: '02-2345678-9', philhealth_no: null, pagibig_no: null, tin: '123-456-789-000', updated_at: '2026-10-01T00:00:00Z'}],
      register_device_token: () => null,
      my_supervised_site_ids: () => [],
    },
    password: 'right-password-1',
    activate: () => ({status: 'activated', login_email: 'g-002@employees.bannuar.invalid'}),
    offline: false,
    rest: (method, table) => api.requests.filter(r => r.method === method && r.path === `/rest/v1/${table}`),
    rpcCalls: name => api.requests.filter(r => r.path === `/rest/v1/rpc/${name}`),
  };

  (global as unknown as {__fetchImpl: unknown}).__fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = init?.body ?? null;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // form-encoded or text
      }
    }
    const rec: Recorded = {method, url: url.toString(), path: url.pathname, query: url.searchParams, headers: headerObject(init?.headers), body};
    api.requests.push(rec);
    if (api.offline) {
      throw new TypeError('Network request failed');
    }
    const path = url.pathname;

    // ---------------------------------------------------------------- auth
    if (path === '/auth/v1/token') {
      const b = body as {password?: string};
      if (url.searchParams.get('grant_type') === 'password' && b?.password !== api.password) {
        return answer({status: 400, body: {code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials'}});
      }
      return answer(session());
    }
    if (path === '/auth/v1/user') {
      return answer(user());
    }
    if (path === '/auth/v1/logout') {
      return answer({status: 204});
    }
    // ---------------------------------------------------------------- edge functions
    if (path === '/functions/v1/activate-employee') {
      const a = api.activate(body as Record<string, unknown>);
      return answer(a);
    }
    // ---------------------------------------------------------------- storage
    if (path.startsWith('/storage/v1/object/sign/')) {
      const rest = decodeURIComponent(path.slice('/storage/v1/object/sign/'.length));
      if (!rest.includes('/')) {
        const paths = (body as {paths: string[]}).paths;
        return answer(paths.map(p => ({path: p, signedURL: `/object/sign/${rest}/${p}?token=t`, error: null})));
      }
      return answer({signedURL: `/object/sign/${rest}?token=t`});
    }
    if (path.startsWith('/storage/v1/object/list/')) {
      return answer([]);
    }
    if (path.startsWith('/storage/v1/object/')) {
      const key = decodeURIComponent(path.slice('/storage/v1/object/'.length));
      return answer({Key: key, Id: 'obj-1'});
    }
    // ---------------------------------------------------------------- PostgREST
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      const h = api.rpc[name];
      return h ? answer(h((body ?? {}) as Record<string, unknown>)) : answer({status: 404, body: {code: 'PGRST202', message: `no mock for ${name}`}});
    }
    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      const single = (rec.headers.accept ?? '').includes('vnd.pgrst.object');
      if (method === 'GET' || method === 'HEAD') {
        const rows = filterRows(api.tables[table] ?? [], url.searchParams);
        const range = {'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`};
        if (method === 'HEAD') {
          return answer({status: 200, body: undefined, headers: range});
        }
        if (single) {
          return rows[0] ? answer(rows[0]) : answer({status: 406, body: {code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned'}});
        }
        return answer({status: 200, body: rows, headers: range});
      }
      if (method === 'POST') {
        return answer({status: 201, body: (rec.headers.prefer ?? '').includes('return=representation') ? [{id: 'new-1', ...(body as object)}] : undefined});
      }
      return answer({status: 204});
    }
    return answer({status: 404, body: {message: 'no mock'}});
  };
  return api;
}

/** Empties the in-memory keychain (the encrypted storage stand-in, jest.setup.js). */
export function clearKeychain() {
  (global as unknown as {__keychain: Map<string, unknown>}).__keychain.clear();
}

export function keychainServices(): string[] {
  return [...(global as unknown as {__keychain: Map<string, unknown>}).__keychain.keys()];
}
