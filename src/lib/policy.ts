import { prisma } from "./db";

interface PolicyCheckOpts {
  category?: string;
  toAddress?: string;
}

interface PolicyResult {
  passed: boolean;
  checks: Record<string, boolean>;
  failureReason?: string;
}

/**
 * Enforce all active spending policies for an agent.
 * Returns whether the transaction passes and a detailed check map.
 */
export async function enforcePolicies(
  agentId: string,
  amountUsdc: number,
  opts: PolicyCheckOpts = {}
): Promise<PolicyResult> {
  const policies = await prisma.spendingPolicy.findMany({
    where: { agentId, isActive: true },
  });

  // No policies → pass by default
  if (policies.length === 0) {
    return { passed: true, checks: {} };
  }

  const checks: Record<string, boolean> = {};

  for (const p of policies) {
    // Per-transaction limit
    if (amountUsdc > p.maxPerTransaction) {
      checks.maxPerTransaction = false;
      return { passed: false, checks, failureReason: `Exceeds per-transaction limit of $${p.maxPerTransaction}` };
    }
    checks.maxPerTransaction = true;

    // Blocked merchants
    if (opts.category && p.blockedMerchants.length > 0 && p.blockedMerchants.includes(opts.category)) {
      checks.blockedMerchant = false;
      return { passed: false, checks, failureReason: `Category "${opts.category}" is blocked` };
    }
    checks.blockedMerchant = true;

    // Allowed categories
    if (opts.category && p.allowedCategories.length > 0 && !p.allowedCategories.includes(opts.category)) {
      checks.allowedCategory = false;
      return { passed: false, checks, failureReason: `Category "${opts.category}" not in allowed list` };
    }
    checks.allowedCategory = true;

    // Allowed recipients
    if (opts.toAddress && p.allowedRecipients.length > 0 && !p.allowedRecipients.includes(opts.toAddress)) {
      checks.allowedRecipient = false;
      return { passed: false, checks, failureReason: "Recipient not in allowlist" };
    }
    checks.allowedRecipient = true;

    // Daily limit
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dailySpent = await prisma.transaction.aggregate({
      where: { fromAgentId: agentId, status: "CONFIRMED", createdAt: { gte: dayStart } },
      _sum: { amountUsdc: true },
    });
    if ((dailySpent._sum.amountUsdc ?? 0) + amountUsdc > p.dailyLimit) {
      checks.dailyLimit = false;
      return { passed: false, checks, failureReason: `Would exceed daily limit of $${p.dailyLimit}` };
    }
    checks.dailyLimit = true;

    // Monthly limit
    if (p.monthlyLimit) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthlySpent = await prisma.transaction.aggregate({
        where: { fromAgentId: agentId, status: "CONFIRMED", createdAt: { gte: monthStart } },
        _sum: { amountUsdc: true },
      });
      if ((monthlySpent._sum.amountUsdc ?? 0) + amountUsdc > p.monthlyLimit) {
        checks.monthlyLimit = false;
        return { passed: false, checks, failureReason: `Would exceed monthly limit of $${p.monthlyLimit}` };
      }
      checks.monthlyLimit = true;
    }

    // Approval gate
    if (p.requireApproval) {
      checks.approval = false;
      return { passed: false, checks, failureReason: "Transaction requires manual approval" };
    }
    checks.approval = true;
  }

  return { passed: true, checks };
}
