import {supabase} from '../config/supabase';
import type {Guard, LeaveRequest, Site} from '../types/db';
import {exec, run} from './db';
import {LEAVE_REQUEST_COLUMNS} from './leave';

/**
 * Detachment commanders and inspectors ("supervisor" role). my_supervised_site_ids() names their
 * posts; row level security lets them read those posts' guards and leave. decide_leave_request checks
 * supervises() itself, so a decision on another post's guard is refused by the database.
 */
export interface PostData {
  sites: Site[];
  guards: Guard[];
  pending: LeaveRequest[];
}

export const GUARD_COLUMNS = 'id,employee_no,first_name,middle_name,last_name,suffix,position,status,site_id';

export async function supervisedSiteIds(): Promise<string[]> {
  return ((await run(supabase.rpc('my_supervised_site_ids'))) as string[] | null) ?? [];
}

export async function loadPost(myEmployeeId: string): Promise<PostData> {
  const ids = await supervisedSiteIds();
  if (!ids.length) {
    return {sites: [], guards: [], pending: []};
  }
  const [sites, guards, pending] = await Promise.all([
    run(supabase.from('sites').select('id,name,code,city').in('id', ids).order('name')),
    run(
      supabase
        .from('employees')
        .select(GUARD_COLUMNS)
        .in('site_id', ids)
        .in('status', ['active', 'on_leave', 'suspended'])
        .order('last_name'),
    ),
    run(
      supabase
        .from('leave_requests')
        .select(LEAVE_REQUEST_COLUMNS)
        .eq('status', 'pending_supervisor')
        .in('site_id', ids)
        .neq('employee_id', myEmployeeId)
        .order('start_date'),
    ),
  ]);
  return {
    sites: (sites ?? []) as Site[],
    guards: (guards ?? []) as Guard[],
    pending: (pending ?? []) as unknown as LeaveRequest[],
  };
}

/** Guards who can relieve the one going on leave: the same post, not on leave, not themselves. */
export function relieverCandidates(data: PostData, request: Pick<LeaveRequest, 'employee_id'>, myEmployeeId: string): Guard[] {
  const requester = data.guards.find(g => g.id === request.employee_id);
  return data.guards.filter(
    g => g.id !== request.employee_id && g.status === 'active' && (!requester?.site_id || g.site_id === requester.site_id || g.id === myEmployeeId),
  );
}

/** Endorse to HR (with a reliever) or decline, through decide_leave_request. */
export async function decideLeave(input: {requestId: string; approve: boolean; note: string | null; relieverId: string | null}): Promise<void> {
  await exec(
    supabase.rpc('decide_leave_request', {
      p_request_id: input.requestId,
      p_approve: input.approve,
      p_note: input.note?.trim() || null,
      p_reliever_id: input.relieverId,
    }),
  );
}

export function isCommander(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes('supervisor'));
}
