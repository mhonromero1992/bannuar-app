/**
 * Copies what the app's tests check against from the HR portal, checked out next to this repository
 * (../bannuar-portal): the schema exported from Postgres and the portal's status wording.
 *   npm run sync:portal
 * Run it whenever the portal's supabase/schema.sql or src/lib/labels.ts changes, then npm test.
 */
import {copyFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const portal = process.env.BANNUAR_PORTAL_DIR ?? `${root}../bannuar-portal`;
const pairs = [
  [`${portal}/tests/schema-snapshot.json`, `${root}__tests__/fixtures/schema-snapshot.json`],
  [`${portal}/src/lib/labels.ts`, `${root}__tests__/fixtures/portal-labels.ts.txt`],
];
for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    console.error(`Not found: ${from}. Check out bannuar-portal next to this repository, or set BANNUAR_PORTAL_DIR.`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log(`copied ${from.replace(portal, 'bannuar-portal')}`);
}
