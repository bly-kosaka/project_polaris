import { z } from 'zod';

/**
 * The frontend's own Zod schema for the `GET /billing` wire response — not a
 * type-only import of `@polaris/domain`'s `EffectiveEntitlement`, same "own
 * toolchain" rule as `ai-explanation-schema.ts`
 * (40_Sprint_5_Plan_Review.md F-02). `BillingSummaryDto` lives ONLY here as
 * the `z.infer` type — never duplicated into `types/dto.ts`
 * (57_Development_Setup_and_Eighth_Sprint.md plan decision 8).
 */
export const billingSummarySchema = z.object({
  plan: z.enum(['free', 'pro']),
  subscription: z.object({
    status: z.string().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    currentPeriodEnd: z.string().optional(),
  }),
  features: z.object({
    aiExplanationRetry: z.boolean(),
  }),
  canManageBilling: z.boolean(),
});

export type BillingSummaryDto = z.infer<typeof billingSummarySchema>;
