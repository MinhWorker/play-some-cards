export class FlowCancelled extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'FlowCancelled';
  }
}

/** Resources stop synchronously; user cleanup runs after the body leaves its finally blocks. */
export class Scope {
  readonly controller = new AbortController();
  readonly children = new Set<Scope>();
  private resources = new Set<() => void>();
  private cleanups: Array<() => void> = [];
  private cleaned = false;
  failure?: { error: unknown };
  step?: string;

  constructor(
    readonly report: (error: unknown) => void,
    readonly parent?: Scope,
  ) {
    parent?.checkpoint();
    parent?.children.add(this);
  }

  get signal() {
    return this.controller.signal;
  }

  checkpoint() {
    if (this.failure) throw this.failure.error;
    if (this.signal.aborted) throw new FlowCancelled(String(this.signal.reason));
  }

  fail(error: unknown) {
    if (this.signal.aborted) return;
    this.failure = { error };
    this.close('failed');
  }

  own(dispose: () => void) {
    this.checkpoint();
    this.resources.add(dispose);
    return () => this.resources.delete(dispose);
  }

  defer(cleanup: () => void) {
    this.checkpoint();
    this.cleanups.push(cleanup);
  }

  close(reason: string) {
    if (this.signal.aborted) return;
    this.controller.abort(reason);
    for (const child of [...this.children]) child.close(reason);
    for (const dispose of [...this.resources]) this.safe(dispose);
    this.resources.clear();
  }

  finish() {
    if (this.cleaned) return;
    this.cleaned = true;
    this.close('completed');
    for (const cleanup of this.cleanups.reverse()) this.safe(cleanup);
    this.cleanups = [];
    this.parent?.children.delete(this);
  }

  private safe(fn: () => void) {
    try {
      fn();
    } catch (error) {
      this.report(error);
    }
  }

  get resourceCount(): number {
    return (
      this.resources.size + [...this.children].reduce((n, child) => n + child.resourceCount, 0)
    );
  }
}
