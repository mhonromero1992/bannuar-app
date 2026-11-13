/**
 * Checks recorded requests against the real schema, exported from Postgres where the portal's
 * supabase/schema.sql ran (fixtures/schema-snapshot.json, npm run sync:portal). The same rules as the
 * portal's e2e check (bannuar-portal tests/e2e.mjs): every table, view, column, embedded relation,
 * filter, order, written column, function and argument must exist. Added here:
 *  - an embed without a foreign key name must have exactly one path (PostgREST answers PGRST201 otherwise)
 *  - storage: the bucket exists, and paths are the ones the storage policies allow an employee
 *  - Edge Functions: only the ones in bannuar-portal/supabase/functions
 */
import {formFields} from './mockApi';
import type {Recorded} from './mockApi';

export interface Snapshot {
  columns: Record<string, string[]>;
  /** Each foreign key's columns: `cols` in the portal's export (tests/schema-snapshot.sql), `columns` before. */
  fks: Array<{name: string; from: string; to: string; cols?: string[]; columns?: string[]}>;
  functions: Record<string, {args: string[]; defaults: number}>;
  pks?: Record<string, string[]>;
  buckets?: string[];
}

export const EDGE_FUNCTIONS = ['activate-employee', 'send-push', 'files', 'payslip-pdf'];

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') {
      depth++;
    }
    if (ch === ')') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) {
    out.push(cur);
  }
  return out.map(x => x.trim()).filter(Boolean);
}

/** Foreign keys either way, and many-to-many through a junction whose primary key holds both (addM2MRels). */
export function relationships(schema: Snapshot, a: string, b: string): string[] {
  const direct = schema.fks.filter(f => (f.from === a && f.to === b) || (f.from === b && f.to === a)).map(f => f.name);
  const junctions = new Set<string>();
  for (const [j, pk] of Object.entries(schema.pks ?? {})) {
    if (j === a || j === b) {
      continue;
    }
    for (const fa of schema.fks.filter(f => f.from === j && f.to === a)) {
      for (const fb of schema.fks.filter(f => f.from === j && f.to === b)) {
        if (fa !== fb && [...(fa.cols ?? fa.columns ?? []), ...(fb.cols ?? fb.columns ?? [])].every(c => pk.includes(c))) {
          junctions.add(j);
        }
      }
    }
  }
  return [...direct, ...junctions];
}

export function checkRequests(requests: Recorded[], schema: Snapshot, employeeId: string): string[] {
  const problems = new Set<string>();
  const cols = schema.columns;
  const fkNames = new Set(schema.fks.map(f => f.name));

  const checkSelect = (table: string, select: string, where: string) => {
    if (!cols[table]) {
      problems.add(`${where}: no table or view "${table}"`);
      return;
    }
    for (const item of splitTop(select)) {
      if (item === '*') {
        continue;
      }
      const m = item.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!(inner|left))?(?:\((.*)\))?$/s);
      if (!m) {
        problems.add(`${where}: cannot read "${item}"`);
        continue;
      }
      const [, , name, hint, , inner] = m;
      if (inner === undefined) {
        if (!cols[table].includes(name)) {
          problems.add(`${where}: no column ${table}.${name}`);
        }
        continue;
      }
      if (inner.trim() === 'count') {
        if (!cols[name]) {
          problems.add(`${where}: no table "${name}" to count`);
        }
        continue;
      }
      const fkHint = hint && hint !== 'inner' && hint !== 'left' ? hint : null;
      if (fkHint && !fkNames.has(fkHint)) {
        problems.add(`${where}: no foreign key "${fkHint}"`);
      }
      if (!cols[name]) {
        problems.add(`${where}: no table "${name}" to embed`);
        continue;
      }
      const paths = relationships(schema, table, name);
      const isView = !schema.fks.some(f => f.from === table || f.to === table);
      if (!paths.length && !isView) {
        problems.add(`${where}: no foreign key between ${table} and ${name}`);
      }
      if (!fkHint && paths.length > 1) {
        problems.add(`${where}: ${table} and ${name} are linked ${paths.length} ways (${paths.join(', ')}): PostgREST answers PGRST201`);
      }
      if (fkHint && !paths.includes(fkHint)) {
        problems.add(`${where}: ${fkHint} does not link ${table} and ${name}`);
      }
      checkSelect(name, inner, `${where} > ${name}`);
    }
  };

  for (const r of requests) {
    const where = `${r.method} ${r.path}`;
    if (r.path.startsWith('/rest/v1/rpc/')) {
      const name = r.path.slice('/rest/v1/rpc/'.length);
      const fn = schema.functions[name];
      if (!fn) {
        problems.add(`${where}: no function ${name}`);
        continue;
      }
      const keys = Object.keys((r.body as object) ?? {});
      for (const k of keys) {
        if (!fn.args.includes(k)) {
          problems.add(`${where}: ${name} has no argument ${k}`);
        }
      }
      for (const a of fn.args.slice(0, fn.args.length - fn.defaults)) {
        if (!keys.includes(a)) {
          problems.add(`${where}: ${name} needs ${a}`);
        }
      }
      continue;
    }
    if (r.path.startsWith('/rest/v1/')) {
      const table = r.path.slice('/rest/v1/'.length);
      if (!cols[table]) {
        problems.add(`${where}: no table or view "${table}"`);
        continue;
      }
      const select = r.query.get('select');
      if (select) {
        checkSelect(table, select, where);
      }
      r.query.forEach((v, k) => {
        if (['select', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) {
          return;
        }
        if (k === 'order') {
          for (const o of v.split(',')) {
            if (!cols[table].includes(o.split('.')[0])) {
              problems.add(`${where}: cannot order by ${o}`);
            }
          }
          return;
        }
        if (!cols[table].includes(k)) {
          problems.add(`${where}: filter on missing ${table}.${k}`);
        }
      });
      if ((r.method === 'POST' || r.method === 'PATCH') && r.body && typeof r.body === 'object') {
        const row = Array.isArray(r.body) ? r.body[0] : r.body;
        for (const k of Object.keys(row)) {
          if (!cols[table].includes(k)) {
            problems.add(`${where}: writes missing column ${table}.${k}`);
          }
        }
      }
      continue;
    }
    if (r.path.startsWith('/storage/v1/object/')) {
      const rest = decodeURIComponent(r.path.slice('/storage/v1/object/'.length));
      const parts = rest.split('/');
      const kind = parts[0] === 'sign' || parts[0] === 'list' ? parts.shift() : 'upload';
      const bucket = parts.shift() ?? '';
      const objectPath = parts.join('/');
      if (!(schema.buckets ?? []).includes(bucket)) {
        problems.add(`${where}: no storage bucket "${bucket}"`);
        continue;
      }
      const own = (p: string) => p.split('/')[0] === employeeId;
      if (kind === 'upload') {
        // "bannuar add employee files": employees write only to <their id>/uploads/;
        // "bannuar add attendance photos": a selfie goes straight into <their id>/
        const ok =
          (bucket === 'employee-files' && new RegExp(`^${employeeId}/uploads/[^/]+$`).test(objectPath)) ||
          (bucket === 'attendance-photos' && new RegExp(`^${employeeId}/[^/]+$`).test(objectPath));
        if (!ok) {
          problems.add(`${where}: employees may only upload to employee-files/<their id>/uploads/ or attendance-photos/<their id>/`);
        }
      } else if (kind === 'sign') {
        const paths = objectPath ? [objectPath] : ((r.body as {paths?: string[]})?.paths ?? []);
        for (const p of paths) {
          if ((bucket === 'employee-files' || bucket === 'certificates') && !own(p)) {
            problems.add(`${where}: ${bucket}/${p} is outside the employee's own folder`);
          }
          if (bucket === 'applications') {
            problems.add(`${where}: employees cannot read applications`);
          }
        }
      }
      continue;
    }
    if (r.path.startsWith('/functions/v1/')) {
      const name = r.path.slice('/functions/v1/'.length);
      if (!EDGE_FUNCTIONS.includes(name)) {
        problems.add(`${where}: no Edge Function ${name}`);
      }
      if (name === 'files') {
        // the app stores only the guard's own documents, leave attachments and selfies, and asks for
        // links to S3 keys only; certificates are HR's (the database refuses the rest anyway)
        const fields = formFields(r.body);
        if (fields) {
          if (!['document', 'leave', 'attendance'].includes(fields.purpose)) {
            problems.add(`${where}: the app uploads only documents, leave attachments and selfies, not "${fields.purpose}"`);
          }
          // the one exception: a commander's photo of a guard of their post at time in or out
          // (begin_file_upload checks supervises() for it)
          if (fields.employee_id && fields.employee_id !== employeeId && fields.purpose !== 'attendance') {
            problems.add(`${where}: an upload goes only to the employee's own folder, or a guard's selfie folder for their commander`);
          }
          if (fields.purpose === 'attendance' && !['time_in', 'time_out'].includes(fields.kind)) {
            problems.add(`${where}: a selfie says time_in or time_out`);
          }
          if (fields.purpose === 'document' && !fields.document_type_id) {
            problems.add(`${where}: a document upload names its document type`);
          }
          if (fields.file !== '[file]') {
            problems.add(`${where}: the upload has no file part named "file"`);
          }
        } else {
          const b = r.body as {action?: string; keys?: unknown} | null;
          if (b?.action !== 'sign' || !Array.isArray(b.keys) || !b.keys.every(k => typeof k === 'string' && k.startsWith('employees/'))) {
            problems.add(`${where}: the files function is asked only to sign S3 keys (employees/...)`);
          }
        }
      }
      continue;
    }
    if (r.path.startsWith('/auth/v1/')) {
      continue;
    }
    problems.add(`${where}: not a Supabase API path`);
  }
  return [...problems];
}
