import { Booking, RequestBookingData } from './booking';
import { BookingRequestedEvent } from './events/booking-requested.event';
import { BookingInThePastError } from './shared/domain-error';
import { Money } from './shared/money';
import { TimeSlot } from './time-slot';

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
});