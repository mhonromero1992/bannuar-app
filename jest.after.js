/* eslint-env jest */
// Every test fails if anything reached a real *.supabase.co host (see jest.setup.js).
afterEach(() => {
  const hits = global.__liveHits.splice(0);
  if (hits.length) {
    throw new Error(`Requests reached the live Supabase project: ${hits.join(', ')}`);
  }
});
