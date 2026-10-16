export function fakeIo(cwd, extra = {}) {
  const out = [];
  const err = [];
  const io = {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    now: () => new Date(2026, 9, 15, 14, 2),
    get out() { return out.join(''); },
    get err() { return err.join(''); },
  };
  return Object.assign(io, extra);
}
