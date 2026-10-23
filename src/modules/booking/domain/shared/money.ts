import { InvalidMoneyError } from './domain-error';

export class Money {
  private constructor(
    readonly amountInCents: number,
    readonly currency: string,
  ) {}

  static of(amountInCents: number, currency = 'BRL'): Money {
    if (!Number.isSafeInteger(amountInCents)) {
      throw new InvalidMoneyError(
        'O valor deve ser um número inteiro de centavos',
      );
    }
    if (amountInCents < 0) {
      throw new InvalidMoneyError('O valor não pode ser negativo');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new InvalidMoneyError(
        'A moeda deve ter 3 letras maiúsculas (ex: BRL, USD)',
      );
    }
    return new Money(amountInCents, currency);
  }

  equals(other: Money): boolean {
    return (
      this.amountInCents === other.amountInCents &&
      this.currency === other.currency
    );
  }
}