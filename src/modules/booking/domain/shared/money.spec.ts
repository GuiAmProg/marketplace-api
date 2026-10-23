import { InvalidMoneyError } from './domain-error';
import { Money } from './money';

describe('Money', () => {
  describe('criação', () => {
    it('cria um valor em centavos com a moeda padrão BRL', () => {
      const money = Money.of(8000);

      expect(money.amountInCents).toBe(8000);
      expect(money.currency).toBe('BRL');
    });

    it('aceita valor zero', () => {
      expect(Money.of(0).amountInCents).toBe(0);
    });

    it('aceita outra moeda', () => {
      expect(Money.of(500, 'USD').currency).toBe('USD');
    });

    it('rejeita valor negativo', () => {
      expect(() => Money.of(-1)).toThrow(InvalidMoneyError);
    });

    it('rejeita valor com casas decimais', () => {
      expect(() => Money.of(10.5)).toThrow(InvalidMoneyError);
    });

    it.each([[NaN], [Infinity], [-Infinity]])(
      'rejeita valor que não é número finito (%s)',
      (value) => {
        expect(() => Money.of(value)).toThrow(InvalidMoneyError);
      },
    );

    it.each([['brl'], ['REAL'], ['R$'], ['']])(
      'rejeita moeda fora do formato de 3 letras maiúsculas ("%s")',
      (currency) => {
        expect(() => Money.of(100, currency)).toThrow(InvalidMoneyError);
      },
    );
  });

  describe('igualdade', () => {
    it('considera iguais dois valores com mesmo montante e moeda', () => {
      expect(Money.of(100).equals(Money.of(100))).toBe(true);
    });

    it('considera diferentes valores com montantes diferentes', () => {
      expect(Money.of(100).equals(Money.of(200))).toBe(false);
    });

    it('considera diferentes valores com moedas diferentes', () => {
      expect(Money.of(100, 'BRL').equals(Money.of(100, 'USD'))).toBe(false);
    });
  });
});