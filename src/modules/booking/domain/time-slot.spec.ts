import { InvalidTimeSlotError } from './shared/domain-error';
import { TimeSlot } from './time-slot';

// Ajudante de teste: devolve 2026-11-03 na hora informada, em UTC.
const at = (hour: number) =>
  new Date(`2026-11-03T${String(hour).padStart(2, '0')}:00:00Z`);

describe('TimeSlot', () => {
  describe('create', () => {
    it('cria um horário com início e fim', () => {
      const slot = TimeSlot.create(at(10), at(11));

      expect(slot.start).toEqual(at(10));
      expect(slot.end).toEqual(at(11));
    });

    it('rejeita fim igual ao início', () => {
      expect(() => TimeSlot.create(at(10), at(10))).toThrow(
        InvalidTimeSlotError,
      );
    });

    it('rejeita fim anterior ao início', () => {
      expect(() => TimeSlot.create(at(11), at(10))).toThrow(
        InvalidTimeSlotError,
      );
    });

    it('rejeita datas inválidas', () => {
      expect(() => TimeSlot.create(new Date('abc'), at(10))).toThrow(
        InvalidTimeSlotError,
      );
      expect(() => TimeSlot.create(at(10), new Date('abc'))).toThrow(
        InvalidTimeSlotError,
      );
    });
  });

  describe('fromDuration', () => {
    it('calcula o fim somando a duração em minutos ao início', () => {
      const slot = TimeSlot.fromDuration(at(10), 90);

      expect(slot.start).toEqual(at(10));
      expect(slot.end).toEqual(new Date('2026-11-03T11:30:00Z'));
    });

    it.each([[0], [-30], [NaN], [Infinity]])(
      'rejeita duração que não seja um número positivo (%s)',
      (minutes) => {
        expect(() => TimeSlot.fromDuration(at(10), minutes)).toThrow(
          InvalidTimeSlotError,
        );
      },
    );
  });

  describe('overlaps', () => {
    it.each([
      { name: 'cruzam parcialmente', a: [10, 12], b: [11, 13], expected: true },
      { name: 'um contém o outro', a: [10, 14], b: [11, 12], expected: true },
      { name: 'são idênticos', a: [10, 12], b: [10, 12], expected: true },
      {
        name: 'A termina exatamente quando B começa',
        a: [10, 11],
        b: [11, 12],
        expected: false,
      },
      {
        name: 'B termina exatamente quando A começa',
        a: [11, 12],
        b: [10, 11],
        expected: false,
      },
      { name: 'estão separados', a: [10, 11], b: [13, 14], expected: false },
    ])('quando $name, o resultado é $expected', ({ a, b, expected }) => {
      const slotA = TimeSlot.create(at(a[0]), at(a[1]));
      const slotB = TimeSlot.create(at(b[0]), at(b[1]));

      expect(slotA.overlaps(slotB)).toBe(expected);
      expect(slotB.overlaps(slotA)).toBe(expected); // vale nos dois sentidos
    });
  });

  describe('hasStartedBy', () => {
    const slot = TimeSlot.create(at(10), at(11));

    it('é falso antes do início', () => {
      expect(slot.hasStartedBy(at(9))).toBe(false);
    });

    it('é verdadeiro exatamente no instante do início', () => {
      expect(slot.hasStartedBy(at(10))).toBe(true);
    });

    it('é verdadeiro depois do início', () => {
      expect(slot.hasStartedBy(at(12))).toBe(true);
    });
  });

  describe('imutabilidade', () => {
    it('não é afetado por alterações na data usada para criá-lo', () => {
      const start = at(10);
      const slot = TimeSlot.create(start, at(11));

      start.setTime(0);

      expect(slot.start).toEqual(at(10));
    });

    it('devolve cópias, então alterar o valor lido não muda o horário', () => {
      const slot = TimeSlot.create(at(10), at(11));

      slot.start.setTime(0);
      slot.end.setTime(0);

      expect(slot.start).toEqual(at(10));
      expect(slot.end).toEqual(at(11));
    });
  });

  describe('equals', () => {
    it('considera iguais horários com mesmo início e fim', () => {
      const a = TimeSlot.create(at(10), at(11));
      const b = TimeSlot.create(at(10), at(11));

      expect(a.equals(b)).toBe(true);
    });

    it('considera diferentes horários com início ou fim distintos', () => {
      const a = TimeSlot.create(at(10), at(11));

      expect(a.equals(TimeSlot.create(at(10), at(12)))).toBe(false);
      expect(a.equals(TimeSlot.create(at(9), at(11)))).toBe(false);
    });
  });
});