import { Booking, BookingProps } from '../../domain/booking';
import { CancellationPolicy } from '../../domain/cancellation-policy';
import {
  BookingAlreadyStartedError,
  InvalidBookingStateError,
} from '../../domain/shared/domain-error';
import { Money } from '../../domain/shared/money';
import { TimeSlot } from '../../domain/time-slot';
import {
  FixedClock,
  InMemoryBookingRepository,
  InMemoryProviderRepository,
  SpyEventPublisher,
} from '../../testing/in-memory.adapters';
import { BookingNotFoundError } from '../errors/booking.errors';
import { ProviderView } from '../ports/out/provider.repository.port';
import { CancelBookingUseCase } from './cancel-booking.use-case';

const NOW = new Date('2026-11-02T12:00:00Z');

const PROVIDER: ProviderView = {
  id: 'provider-1',
  userId: 'user-provider-1',
  isAvailableFor: () => true,
};

// Reserva paga, de 60 minutos, a partir de `startAt`.
const storedBooking = (
  startAt: string,
  overrides: Partial<BookingProps> = {},
) =>
  Booking.restore({
    id: 'booking-1',
    customerId: 'customer-1',
    providerId: 'provider-1',
    serviceId: 'service-1',
    timeSlot: TimeSlot.fromDuration(new Date(startAt), 60),
    price: Money.of(8000),
    cancellationPolicy: CancellationPolicy.standard(),
    status: 'CONFIRMED',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    expiresAt: new Date('2026-11-01T10:15:00Z'),
    ...overrides,
  });

function makeSut(booking?: Booking) {
  const bookings = new InMemoryBookingRepository();
  if (booking) bookings.items.push(booking);
  const events = new SpyEventPublisher();
  const useCase = new CancelBookingUseCase(
    bookings,
    new InMemoryProviderRepository([PROVIDER]),
    new FixedClock(NOW),
    events,
  );
  return { useCase, bookings, events };
}

describe('CancelBookingUseCase', () => {
  describe('quando o cancelamento é permitido', () => {
    it.each([
      {
        name: 'cliente cancela com 50 horas de antecedência',
        startAt: '2026-11-04T14:00:00Z',
        requesterId: 'customer-1',
        overrides: {},
        cancelledBy: 'CUSTOMER',
        refund: 8000,
      },
      {
        name: 'cliente cancela com 20 horas de antecedência',
        startAt: '2026-11-03T08:00:00Z',
        requesterId: 'customer-1',
        overrides: {},
        cancelledBy: 'CUSTOMER',
        refund: 4000,
      },
      {
        name: 'cliente cancela com 1 hora de antecedência',
        startAt: '2026-11-02T13:00:00Z',
        requesterId: 'customer-1',
        overrides: {},
        cancelledBy: 'CUSTOMER',
        refund: 0,
      },
      {
        name: 'prestador cancela com 1 hora de antecedência',
        startAt: '2026-11-02T13:00:00Z',
        requesterId: 'user-provider-1',
        overrides: {},
        cancelledBy: 'PROVIDER',
        refund: 8000,
      },
      {
        name: 'cliente cancela uma reserva ainda não paga',
        startAt: '2026-11-04T14:00:00Z',
        requesterId: 'customer-1',
        overrides: { status: 'PENDING_PAYMENT' as const },
        cancelledBy: 'CUSTOMER',
        refund: 0,
      },
    ])(
      '$name',
      async ({ startAt, requesterId, overrides, cancelledBy, refund }) => {
        const { useCase, bookings, events } = makeSut(
          storedBooking(startAt, overrides),
        );

        const output = await useCase.execute({
          bookingId: 'booking-1',
          requesterId,
        });

        expect(output).toEqual({
          bookingId: 'booking-1',
          status: 'CANCELLED',
          cancelledBy,
          refundInCents: refund,
        });

        const saved = await bookings.findById('booking-1');
        expect(saved?.status).toBe('CANCELLED');
        expect(saved?.isActive).toBe(false);

        expect(events.published).toMatchObject([
          { name: 'BookingCancelled', refundInCents: refund, cancelledBy },
        ]);
      },
    );
  });

  describe('quando o cancelamento não é permitido', () => {
    it('rejeita uma reserva que não existe', async () => {
      const { useCase, events } = makeSut();

      await expect(
        useCase.execute({ bookingId: 'nao-existe', requesterId: 'customer-1' }),
      ).rejects.toThrow(BookingNotFoundError);

      expect(events.published).toHaveLength(0);
    });

    it('trata quem não é cliente nem prestador como "não encontrada" e não altera nada', async () => {
      const { useCase, bookings, events } = makeSut(
        storedBooking('2026-11-04T14:00:00Z'),
      );

      await expect(
        useCase.execute({ bookingId: 'booking-1', requesterId: 'intruso' }),
      ).rejects.toThrow(BookingNotFoundError);

      expect((await bookings.findById('booking-1'))?.status).toBe('CONFIRMED');
      expect(events.published).toHaveLength(0);
    });

    it('rejeita cancelar uma reserva que já foi cancelada', async () => {
      const { useCase, events } = makeSut(
        storedBooking('2026-11-04T14:00:00Z', { status: 'CANCELLED' }),
      );

      await expect(
        useCase.execute({ bookingId: 'booking-1', requesterId: 'customer-1' }),
      ).rejects.toThrow(InvalidBookingStateError);

      expect(events.published).toHaveLength(0);
    });

    it('rejeita cancelar uma reserva cujo horário já começou', async () => {
      const { useCase, bookings, events } = makeSut(
        storedBooking('2026-11-02T11:00:00Z'),
      );

      await expect(
        useCase.execute({ bookingId: 'booking-1', requesterId: 'customer-1' }),
      ).rejects.toThrow(BookingAlreadyStartedError);

      expect((await bookings.findById('booking-1'))?.status).toBe('CONFIRMED');
      expect(events.published).toHaveLength(0);
    });
  });
});