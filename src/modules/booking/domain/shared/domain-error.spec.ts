import { DomainError, InvalidMoneyError } from './domain-error';

describe('DomainError', () => {
  it('usa o nome da classe filha como nome do erro', () => {
    const error = new InvalidMoneyError('valor inválido');

    expect(error.name).toBe('InvalidMoneyError');
  });

  it('mantém a mensagem informada', () => {
    const error = new InvalidMoneyError('valor inválido');

    expect(error.message).toBe('valor inválido');
  });

  it('é reconhecido como Error e como DomainError', () => {
    const error = new InvalidMoneyError('valor inválido');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });
});