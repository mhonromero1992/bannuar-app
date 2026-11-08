/**
 * A random v4-style id for file names. Hermes has no crypto.randomUUID; this only needs to be unique
 * within a guard's own uploads folder, not secret.
 */
export function randomId(): string {
  const hex = (n: number) =>
    Array.from({length: n}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
