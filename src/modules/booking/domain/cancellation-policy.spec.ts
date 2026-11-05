import { CancellationPolicy } from './cancellation-policy';
import { InvalidCancellationPolicyError } from './shared/domain-error';

const START = new Date('2026-11-10T14:00:00Z');

// Devolve o instante do cancelamento, X minutos antes do início.
const minutesBefore = (minutes: number) =>
  new Date(START.getTime() - minutes * 60_000);

describe('CancellationPolicy', () => {
  describe('create', () => {
    it('cria uma política com faixas válidas', () => {
      const policy = CancellationPolicy.create([
        { minHoursBeforeStart: 48, refundPercent: 100 },
        { minHoursBeforeStart: 0, refundPercent: 20 },
      ]);

      expect(policy.tiers).toHaveLength(2);
    });

    it('ordena as faixas da maior antecedência para a menor', () => {
      const policy = CancellationPolicy.create([
        { minHoursBeforeStart: 0, refundPercent: 0 },
        { minHoursBeforeStart: 24, refundPercent: 100 },
      ]);

      expect(policy.tiers.map((t) => t.minHoursBeforeStart)).toEqual([24, 0]);
    });

    it('rejeita lista vazia', () => {
      expect(() => CancellationPolicy.create([])).toThrow(
        InvalidCancellationPolicyError,
      );
    });

    it('rejeita política sem faixa de 0 horas (haveria momentos sem regra)', () => {
      expect(() =>
        CancellationPolicy.create([
          { minHoursBeforeStart: 24, refundPercent: 100 },
        ]),
      ).toThrow(InvalidCancellationPolicyError);
    });

    it.each([[-1], [101], [50.5], [NaN]])(
      'rejeita porcentagem de reembolso inválida (%s)',
      (refundPercent) => {
        expect(() =>
          CancellationPolicy.create([{ minHoursBeforeStart: 0, refundPercent }]),
        ).toThrow(InvalidCancellationPolicyError);
      },
    );

    it.each([[-1], [NaN], [Infinity]])(
      'rejeita antecedência inválida (%s)',
      (minHoursBeforeStart) => {
        expect(() =>
          CancellationPolicy.create([
            { minHoursBeforeStart, refundPercent: 50 },
            { minHoursBeforeStart: 0, refundPercent: 0 },
          ]),
        ).toThrow(InvalidCancellationPolicyError);
      },
    );

    it('rejeita duas faixas com a mesma antecedência', () => {
      expect(() =>
        CancellationPolicy.create([
          { minHoursBeforeStart: 24, refundPercent: 100 },
          { minHoursBeforeStart: 24, refundPercent: 50 },
          { minHoursBeforeStart: 0, refundPercent: 0 },
        ]),
      ).toThrow(InvalidCancellationPolicyError);
    });

    it('rejeita reembolso que aumenta quando a antecedência diminui', () => {
      expect(() =>
        CancellationPolicy.create([
          { minHoursBeforeStart: 24, refundPercent: 20 },
          { minHoursBeforeStart: 0, refundPercent: 80 },
        ]),
      ).toThrow(InvalidCancellationPolicyError);
    });
  });

  describe('standard', () => {
    it('é 100% com 24h ou mais, 50% com 2h ou mais e 0% abaixo disso', () => {
      expect(CancellationPolicy.standard().tiers).toEqual([
        { minHoursBeforeStart: 24, refundPercent: 100 },
        { minHoursBeforeStart: 2, refundPercent: 50 },
        { minHoursBeforeStart: 0, refundPercent: 0 },
      ]);
    });
  });

  describe('refundPercentFor', () => {
    const policy = CancellationPolicy.standard();

    it.each([
      { name: '50 horas antes', minutes: 3000, expected: 100 },
      { name: 'exatamente 24 horas antes', minutes: 1440, expected: 100 },
      { name: '1 minuto menos de 24 horas antes', minutes: 1439, expected: 50 },
      { name: 'exatamente 2 horas antes', minutes: 120, expected: 50 },
      { name: '1 minuto menos de 2 horas antes', minutes: 119, expected: 0 },
      { name: '10 minutos antes', minutes: 10, expected: 0 },
      { name: 'no instante do início', minutes: 0, expected: 0 },
      { name: 'depois do início', minutes: -10, expected: 0 },
    ])('cancelando $name, devolve $expected%', ({ minutes, expected }) => {
      expect(policy.refundPercentFor(START, minutesBefore(minutes))).toBe(
        expected,
      );
    });
  });

  describe('imutabilidade', () => {
    it('devolve cópias das faixas, então alterá-las não muda a política', () => {
      const policy = CancellationPolicy.standard();

      policy.tiers[0].refundPercent = 0;

      expect(policy.tiers[0].refundPercent).toBe(100);
    });
  });
});