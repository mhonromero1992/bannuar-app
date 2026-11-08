/** Unwraps a Supabase answer: the data, or the error thrown as it came (lib/errors.ts words it). */
export async function run<T>(query: PromiseLike<{data: T | null; error: unknown}>): Promise<T> {
  const {data, error} = await query;
  if (error) {
    throw error;
  }
  return data as T;
}

/** The same, for writes whose answer the app does not need. */
export async function exec(query: PromiseLike<{error: unknown}>): Promise<void> {
  const {error} = await query;
  if (error) {
    throw error;
  }
}
