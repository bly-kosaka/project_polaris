import type { prisma } from '@polaris/db';

type PrismaLike = typeof prisma;

/**
 * `vi.spyOn(deps.prisma.analysis, 'update')` looked like the natural way to
 * fault-inject a specific write, but it does not reliably restore: Prisma
 * 7's model delegates (`prisma.analysis`, etc.) are Proxy-backed, and
 * `vi.restoreAllMocks()` left `analysis.update` broken (`is not a
 * function`) for every test running afterward in the same file — since
 * `@polaris/db`'s `prisma` export is one process-wide singleton, that
 * leakage silently corrupted unrelated tests. These wrappers fault-inject
 * without ever mutating the shared singleton: each returns a fresh,
 * request-scoped Proxy that only the caller's `WorkerDeps.prisma` points
 * at, so nothing needs restoring afterward.
 */
export function withFailingMethod(
  base: PrismaLike,
  model: string,
  method: string,
  failFirstNCalls: number,
  message: string,
): PrismaLike {
  let callCount = 0;
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== model) return Reflect.get(target, prop, receiver);
      const delegate = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
      return new Proxy(delegate, {
        get(delegateTarget, delegateProp, delegateReceiver) {
          if (delegateProp !== method) return Reflect.get(delegateTarget, delegateProp, delegateReceiver);
          const original = Reflect.get(delegateTarget, delegateProp, delegateReceiver) as (
            ...args: unknown[]
          ) => unknown;
          return (...args: unknown[]) => {
            callCount += 1;
            if (callCount <= failFirstNCalls) return Promise.reject(new Error(message));
            return original.apply(delegateTarget, args);
          };
        },
      });
    },
  }) as PrismaLike;
}

export function withFailingAnalysisUpdate(base: PrismaLike, failFirstNCalls: number, message: string): PrismaLike {
  return withFailingMethod(base, 'analysis', 'update', failFirstNCalls, message);
}

export function withFailingObservationSetLookup(
  base: PrismaLike,
  failFirstNCalls: number,
  message: string,
): PrismaLike {
  return withFailingMethod(base, 'observationSetRecord', 'findUnique', failFirstNCalls, message);
}

/**
 * `analysisExecution.update()` is called at multiple stages (marking
 * `running` before the Analyzer runs, then `success`/`partial`/`failed`
 * afterward) — failing *every* call would break the earlier `running`
 * transition too and never reach the finalize-time call a test actually
 * wants to target. This only fails the call that sets `completedAt`, which
 * uniquely identifies the finalize-time write.
 */
export function withFailingExecutionUpdateOnFinalize(base: PrismaLike, message: string): PrismaLike {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== 'analysisExecution') return Reflect.get(target, prop, receiver);
      const delegate = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
      return new Proxy(delegate, {
        get(delegateTarget, delegateProp, delegateReceiver) {
          if (delegateProp !== 'update') return Reflect.get(delegateTarget, delegateProp, delegateReceiver);
          const original = Reflect.get(delegateTarget, delegateProp, delegateReceiver) as (
            ...args: unknown[]
          ) => unknown;
          return (...args: unknown[]) => {
            const callArgs = args[0] as { data?: { completedAt?: unknown } } | undefined;
            if (callArgs?.data?.completedAt !== undefined) {
              return Promise.reject(new Error(message));
            }
            return original.apply(delegateTarget, args);
          };
        },
      });
    },
  }) as PrismaLike;
}

export function withFailingTransaction(base: PrismaLike, message: string): PrismaLike {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== '$transaction') return Reflect.get(target, prop, receiver);
      return () => Promise.reject(new Error(message));
    },
  }) as PrismaLike;
}
