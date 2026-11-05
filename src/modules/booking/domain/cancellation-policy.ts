import { InvalidCancellationPolicyError } from './shared/domain-error';

export interface RefundTier {
  /** Antecedência mínima (em horas, antes do início) para esta faixa valer. */
  minHoursBeforeStart: number;
  /** Porcentagem do valor devolvida (0 a 100). */
  refundPercent: number;
}

export class CancellationPolicy {
  private constructor(private readonly sortedTiers: readonly RefundTier[]) {}

  static create(tiers: RefundTier[]): CancellationPolicy {
    if (tiers.length === 0) {
      throw new InvalidCancellationPolicyError(
        'A política precisa ter ao menos uma faixa',
      );
    }

    for (const tier of tiers) {
      if (
        !Number.isFinite(tier.minHoursBeforeStart) ||
        tier.minHoursBeforeStart < 0
      ) {
        throw new InvalidCancellationPolicyError(
          'A antecedência da faixa deve ser um número maior ou igual a zero',
        );
      }
      if (
        !Number.isInteger(tier.refundPercent) ||
        tier.refundPercent < 0 ||
        tier.refundPercent > 100
      ) {
        throw new InvalidCancellationPolicyError(
          'O reembolso deve ser um inteiro entre 0 e 100',
        );
      }
    }

    // Da maior antecedência para a menor. Copiamos para não alterar a lista recebida.
    const sorted = tiers
      .map((tier) => ({ ...tier }))
      .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minHoursBeforeStart === sorted[i - 1].minHoursBeforeStart) {
        throw new InvalidCancellationPolicyError(
          'Não pode haver duas faixas com a mesma antecedência',
        );
      }
      if (sorted[i].refundPercent > sorted[i - 1].refundPercent) {
        throw new InvalidCancellationPolicyError(
          'O reembolso não pode aumentar conforme a antecedência diminui',
        );
      }
    }

    if (sorted[sorted.length - 1].minHoursBeforeStart !== 0) {
      throw new InvalidCancellationPolicyError(
        'A política precisa ter uma faixa de 0 horas para cobrir cancelamentos de última hora',
      );
    }

    return new CancellationPolicy(sorted);
  }

  /** Política padrão: 100% com 24h ou mais, 50% com 2h ou mais, 0% abaixo disso. */
  static standard(): CancellationPolicy {
    return CancellationPolicy.create([
      { minHoursBeforeStart: 24, refundPercent: 100 },
      { minHoursBeforeStart: 2, refundPercent: 50 },
      { minHoursBeforeStart: 0, refundPercent: 0 },
    ]);
  }

  get tiers(): RefundTier[] {
    return this.sortedTiers.map((tier) => ({ ...tier }));
  }

  /** Porcentagem devolvida se o cancelamento ocorrer em `cancelledAt`. */
  refundPercentFor(startsAt: Date, cancelledAt: Date): number {
    const hoursBefore =
      (startsAt.getTime() - cancelledAt.getTime()) / 3_600_000;

    const tier = this.sortedTiers.find(
      (candidate) => hoursBefore >= candidate.minHoursBeforeStart,
    );
    return tier ? tier.refundPercent : 0;
  }
}