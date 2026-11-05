import { Booking, RequestBookingData } from './booking';
import { BookingRequestedEvent } from './events/booking-requested.event';
import { Money } from './shared/money';
import { TimeSlot } from './time-slot';
import { CancellationPolicy } from './cancellation-policy';
import { BookingProps, BookingStatus } from './booking';
import {
  BookingAlreadyStartedError,
  BookingInThePastError,
  InvalidBookingStateError,
} from './shared/domain-error';

// Ajudante de teste: data em novembro de 2026, em UTC.
const at = (day: number, hour: number) =>
  new Date(
    `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`,
  );

const NOW = at(2, 12);

// Dados válidos por padrão; cada teste troca só o que quer testar.
const validData = (
  overrides: Partial<RequestBookingData> = {},
): RequestBookingData => ({
  id: 'booking-1',
  customerId: 'customer-1',
  providerId: 'provider-1',
  serviceId: 'service-1',
  timeSlot: TimeSlot.fromDuration(at(3, 14), 60),
   price: Money.of(8000),
  cancellationPolicy: CancellationPolicy.standard(),
  ...overrides,
});

describe('Booking', () => {
  describe('request', () => {
    it('cria a reserva aguardando pagamento', () => {
      const booking = Booking.request(validData(), NOW);

      expect(booking.status).toBe('PENDING_PAYMENT');
      expect(booking.isActive).toBe(true);
    });

    it('guarda os dados informados', () => {
      const data = validData();
      const booking = Booking.request(data, NOW);

      expect(booking.id).toBe('booking-1');
      expect(booking.customerId).toBe('customer-1');
      expect(booking.providerId).toBe('provider-1');
      expect(booking.serviceId).toBe('service-1');
      expect(booking.timeSlot.equals(data.timeSlot)).toBe(true);
      expect(booking.price.equals(Money.of(8000))).toBe(true);
    });

    it('registra a data de criação', () => {
      const booking = Booking.request(validData(), NOW);

      expect(booking.createdAt).toEqual(NOW);
    });

    it('define o prazo de pagamento em 15 minutos após a criação', () => {
      const booking = Booking.request(validData(), NOW);

      expect(booking.expiresAt).toEqual(new Date('2026-11-02T12:15:00Z'));
    });

    it('rejeita horário que já passou', () => {
      const past = TimeSlot.fromDuration(at(1, 10), 60);

      expect(() =>
        Booking.request(validData({ timeSlot: past }), NOW),
      ).toThrow(BookingInThePastError);
    });

    it('rejeita horário que começa exatamente agora', () => {
      const startingNow = TimeSlot.fromDuration(NOW, 60);

      expect(() =>
        Booking.request(validData({ timeSlot: startingNow }), NOW),
      ).toThrow(BookingInThePastError);
    });
  });

  describe('eventos', () => {
    it('registra o evento BookingRequested com os dados da reserva', () => {
      const booking = Booking.request(validData(), NOW);

      const events = booking.pullEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingRequestedEvent);
      expect(events[0]).toMatchObject({
        name: 'BookingRequested',
        bookingId: 'booking-1',
        customerId: 'customer-1',
        providerId: 'provider-1',
        occurredAt: NOW,
      });
    });

    it('não repete o evento depois de retirado', () => {
      const booking = Booking.request(validData(), NOW);

      booking.pullEvents();

      expect(booking.pullEvents()).toEqual([]);
    });

    it('não registra evento quando a criação falha', () => {
      const past = TimeSlot.fromDuration(at(1, 10), 60);

      expect(() =>
        Booking.request(validData({ timeSlot: past }), NOW),
      ).toThrow();
    });
  });

  describe('imutabilidade', () => {
    it('devolve cópias das datas, então alterá-las não muda a reserva', () => {
      const booking = Booking.request(validData(), NOW);

      booking.createdAt.setTime(0);
      booking.expiresAt.setTime(0);

      expect(booking.createdAt).toEqual(NOW);
      expect(booking.expiresAt).toEqual(new Date('2026-11-02T12:15:00Z'));
    });
  });

  describe('restore', () => {
    const stored = {
      ...validData({ timeSlot: TimeSlot.fromDuration(at(1, 10), 60) }),
      status: 'COMPLETED' as const,
      cancellationPolicy: CancellationPolicy.standard(),
      createdAt: at(1, 8),
      expiresAt: at(1, 8),
      
    };

    it('reconstrói uma reserva do passado sem rejeitá-la', () => {
      const booking = Booking.restore(stored);

      expect(booking.status).toBe('COMPLETED');
      expect(booking.isActive).toBe(false);
    });

    it('não gera eventos ao reconstruir', () => {
      expect(Booking.restore(stored).pullEvents()).toEqual([]);
    });
  });
    // Reserva já paga, com os eventos de criação e confirmação descartados,
  // para o teste olhar só para o que acontece depois.
  const confirmedBooking = (overrides: Partial<RequestBookingData> = {}) => {
    const booking = Booking.request(validData(overrides), NOW);
    booking.confirm(NOW);
    booking.pullEvents();
    return booking;
  };

  describe('confirm', () => {
    it('muda o status para CONFIRMED e a reserva continua ativa', () => {
      const booking = Booking.request(validData(), NOW);

      booking.confirm(NOW);

      expect(booking.status).toBe('CONFIRMED');
      expect(booking.isActive).toBe(true);
    });

    it('registra o evento BookingConfirmed', () => {
      const booking = Booking.request(validData(), NOW);
      booking.pullEvents();

      booking.confirm(NOW);

      expect(booking.pullEvents()).toMatchObject([
        { name: 'BookingConfirmed', bookingId: 'booking-1', occurredAt: NOW },
      ]);
    });

    it('rejeita confirmar uma reserva que não está aguardando pagamento', () => {
      const booking = confirmedBooking();

      expect(() => booking.confirm(NOW)).toThrow(InvalidBookingStateError);
    });
  });

  describe('cancel', () => {
    it.each([
      { name: 'com 26 horas de antecedência', when: NOW, expected: 8000 },
      { name: 'com 12 horas de antecedência', when: at(3, 2), expected: 4000 },
      { name: 'com 1 hora de antecedência', when: at(3, 13), expected: 0 },
    ])(
      'cliente cancelando reserva paga $name recebe $expected centavos de volta',
      ({ when, expected }) => {
        const booking = confirmedBooking(); // horário: dia 3, 14h

        const refund = booking.cancel('CUSTOMER', when);

        expect(refund.amountInCents).toBe(expected);
        expect(booking.refundAmount?.amountInCents).toBe(expected);
      },
    );

    it('prestador cancelando reserva paga devolve 100%, mesmo em cima da hora', () => {
      const booking = confirmedBooking();

      const refund = booking.cancel('PROVIDER', at(3, 13));

      expect(refund.amountInCents).toBe(8000);
    });

    it('cancelar reserva ainda não paga não gera reembolso', () => {
      const booking = Booking.request(validData(), NOW);

      const refund = booking.cancel('CUSTOMER', NOW);

      expect(refund.amountInCents).toBe(0);
      expect(booking.status).toBe('CANCELLED');
    });

    it('registra quem cancelou, quando e libera o horário', () => {
      const booking = confirmedBooking();

      booking.cancel('CUSTOMER', NOW);

      expect(booking.status).toBe('CANCELLED');
      expect(booking.isActive).toBe(false);
      expect(booking.cancelledBy).toBe('CUSTOMER');
      expect(booking.cancelledAt).toEqual(NOW);
    });

    it('usa a política gravada na própria reserva, não a padrão', () => {
      const generous = CancellationPolicy.create([
        { minHoursBeforeStart: 0, refundPercent: 100 },
      ]);
      const booking = confirmedBooking({ cancellationPolicy: generous });

      // Com a política padrão, 1 hora antes devolveria 0%.
      const refund = booking.cancel('CUSTOMER', at(3, 13));

      expect(refund.amountInCents).toBe(8000);
    });

    it('registra o evento BookingCancelled com o valor do reembolso', () => {
      const booking = confirmedBooking();

      booking.cancel('CUSTOMER', at(3, 2)); // 12h antes: 50%

      expect(booking.pullEvents()).toMatchObject([
        {
          name: 'BookingCancelled',
          bookingId: 'booking-1',
          customerId: 'customer-1',
          providerId: 'provider-1',
          cancelledBy: 'CUSTOMER',
          refundInCents: 4000,
          occurredAt: at(3, 2),
        },
      ]);
    });

    it.each<BookingStatus>(['CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW'])(
      'rejeita cancelar uma reserva com status %s',
      (status) => {
        const booking = Booking.restore({
          ...validData(),
          status,
          createdAt: at(1, 8),
          expiresAt: at(1, 9),
        } as BookingProps);

        expect(() => booking.cancel('CUSTOMER', NOW)).toThrow(
          InvalidBookingStateError,
        );
      },
    );

    it('rejeita cancelar depois que o horário começou', () => {
      const booking = confirmedBooking(); // começa no dia 3, 14h

      expect(() => booking.cancel('CUSTOMER', at(3, 14))).toThrow(
        BookingAlreadyStartedError,
      );
    });

    it('não altera a reserva nem registra evento quando o cancelamento falha', () => {
      const booking = confirmedBooking();

      expect(() => booking.cancel('CUSTOMER', at(3, 15))).toThrow();

      expect(booking.status).toBe('CONFIRMED');
      expect(booking.cancelledAt).toBeNull();
      expect(booking.pullEvents()).toEqual([]);
    });
  });
});