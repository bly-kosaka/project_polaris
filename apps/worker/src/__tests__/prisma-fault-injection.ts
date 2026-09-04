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
export function withFailingAnalysisUpdate(base: PrismaLike, failFirstNCalls: number, message: string): PrismaLike {
  let callCount = 0;
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== 'analysis') return Reflect.get(target, prop, receiver);
      const analysisDelegate = Reflect.get(target, prop, receiver) as unknown as Record<string, unknown>;
      return new Proxy(analysisDelegate, {
        get(delegateTarget, delegateProp, delegateReceiver) {
          if (delegateProp !== 'update') return Reflect.get(delegateTarget, delegateProp, delegateReceiver);
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

export function withFailingTransaction(base: PrismaLike, message: string): PrismaLike {
  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== '$transaction') return Reflect.get(target, prop, receiver);
      return () => Promise.reject(new Error(message));
    },
  }) as PrismaLike;
}
