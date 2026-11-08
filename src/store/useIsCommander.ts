import {isCommander} from '../services/commander';
import type {HomeData} from '../services/home';
import {KEYS} from './keys';
import {useResources} from './resources';
import {useRoles} from './session';

/** "My post" shows for the supervisor role, or for a guard named commander of a post (Home finds out). */
export function useIsCommander(): boolean {
  const roles = useRoles();
  const namedOnPost = useResources(s => {
    const home = s.entries[KEYS.home]?.data as HomeData | undefined;
    return home ? home.toEndorse !== null : false;
  });
  return isCommander(roles) || namedOnPost;
}
