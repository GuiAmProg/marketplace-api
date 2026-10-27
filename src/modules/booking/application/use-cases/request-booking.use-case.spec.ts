import { Booking } from '../../domain/booking';
import { BookingRequestedEvent } from '../../domain/events/booking-requested.event';
import {
  BookingInThePastError,
  InvalidTimeSlotError,
} from '../../domain/shared/domain-error';
import { Money } from '../../domain/shared/money';
import { TimeSlot } from '../../domain/time-slot';
import {
  FixedClock,
  InMemoryBookingRepository,
  InMemoryProviderRepository,
  InMemoryServiceRepository,
  SequentialIdGenerator,
  SpyEventPublisher,
} from '../../testing/in-memory.adapters';
import {
  ProviderNotFoundError,
  ProviderUnavailableError,
  SelfBookingNotAllowedError,
  ServiceInactiveError,
  ServiceNotFoundError,
  SlotAlreadyTakenError,
} from '../errors/booking.errors';
import { ProviderView } from '../ports/out/provider.repository.port';
import { ServiceView } from '../ports/out/service.repository.port';
import { RequestBookingUseCase } from './request-booking.use-case';

const NOW = new Date('2026-11-02T12:00:00Z');
const START = new Date('2026-11-03T14:00:00Z');

const SERVICE: ServiceView = {
  id: 'service-1',
  providerId: 'provider-1',
  durationMinutes: 60,
  price: Money.of(8000),
  active: true,
};

const PROVIDER: ProviderView = {
  id: 'provider-1',
  userId: 'user-provider-1',
  isAvailableFor: () => true,
};

// Monta o caso de uso com adapters falsos. Por padrão existem um serviço e um
// prestador válidos; cada teste troca só o que precisa.
function makeSut(
  setup: { services?: ServiceView[]; providers?: ProviderView[] } = {},
) {
  const bookings = new InMemoryBookingRepository();
  const events = new SpyEventPublisher();
  const useCase = new RequestBookingUseCase(
    bookings,
    new InMemoryServiceRepository(setup.services ?? [SERVICE]),
    new InMemoryProviderRepository(setup.providers ?? [PROVIDER]),
    new FixedClock(NOW),
    new SequentialIdGenerator(),
    events,
  );
  return { useCase, bookings, events };
}

const validInput = {
  customerId: 'customer-1',
  serviceId: 'service-1',
  startAt: START,
};

describe('RequestBookingUseCase', () => {
  describe('quando os dados são válidos', () => {
    it('cria a reserva aguardando pagamento e devolve o resumo', async () => {
      const { useCase } = makeSut();

      const output = await useCase.execute(validInput);

      expect(output).toEqual({
        bookingId: 'id-1',
        status: 'PENDING_PAYMENT',
        priceInCents: 8000,
        expiresAt: new Date('2026-11-02T12:15:00Z'),
      });
    });

    it('salva a reserva com o preço do serviço e o horário calculado', async () => {
      const { useCase, bookings } = makeSut();

      await useCase.execute(validInput);

      expect(bookings.items).toHaveLength(1);
      const saved = bookings.items[0];
      expect(saved.customerId).toBe('customer-1');
      expect(saved.providerId).toBe('provider-1');
      expect(saved.price.equals(Money.of(8000))).toBe(true);
      expect(saved.timeSlot.start).toEqual(START);
      expect(saved.timeSlot.end).toEqual(new Date('2026-11-03T15:00:00Z'));
    });

    it('publica o evento BookingRequested', async () => {
      const { useCase, events } = makeSut();

      await useCase.execute(validInput);

      expect(events.published).toHaveLength(1);
      expect(events.published[0]).toBeInstanceOf(BookingRequestedEvent);
      expect(events.published[0]).toMatchObject({
        name: 'BookingRequested',
        bookingId: 'id-1',
        customerId: 'customer-1',
        providerId: 'provider-1',
      });
    });
  });

  describe('quando uma regra de negócio falha', () => {
    it.each([
      {
        name: 'serviço inexistente',
        setup: { services: [] as ServiceView[] },
        input: validInput,
        error: ServiceNotFoundError,
      },
      {
        name: 'serviço inativo',
        setup: { services: [{ ...SERVICE, active: false }] },
        input: validInput,
        error: ServiceInactiveError,
      },
      {
        name: 'prestador inexistente',
        setup: { providers: [] as ProviderView[] },
        input: validInput,
        error: ProviderNotFoundError,
      },
      {
        name: 'prestador agendando o próprio serviço',
        setup: {},
        input: { ...validInput, customerId: 'user-provider-1' },
        error: SelfBookingNotAllowedError,
      },
      {
        name: 'horário fora da jornada do prestador',
        setup: { providers: [{ ...PROVIDER, isAvailableFor: () => false }] },
        input: validInput,
        error: ProviderUnavailableError,
      },
      {
        name: 'horário no passado',
        setup: {},
        input: { ...validInput, startAt: new Date('2026-11-01T10:00:00Z') },
        error: BookingInThePastError,
      },
      {
        name: 'data de início inválida',
        setup: {},
        input: { ...validInput, startAt: new Date('abc') },
        error: InvalidTimeSlotError,
      },
    ])(
      'rejeita: $name',
      async ({ setup, input, error }) => {
        const { useCase, bookings, events } = makeSut(setup);

        await expect(useCase.execute(input)).rejects.toThrow(error);

        // Falhou: nada pode ter sido salvo nem publicado.
        expect(bookings.items).toHaveLength(0);
        expect(events.published).toHaveLength(0);
      },
    );
  });

  describe('conflito de horário', () => {
    it('rejeita um horário já reservado e não cria uma segunda reserva', async () => {
      const { useCase, bookings, events } = makeSut();
      await useCase.execute(validInput);

      await expect(
        useCase.execute({ ...validInput, customerId: 'customer-2' }),
      ).rejects.toThrow(SlotAlreadyTakenError);

      expect(bookings.items).toHaveLength(1);
      expect(events.published).toHaveLength(1);
    });

    it('rejeita um horário que cruza parcialmente com outro', async () => {
      const { useCase } = makeSut();
      await useCase.execute(validInput); // 14h às 15h

      await expect(
        useCase.execute({
          ...validInput,
          customerId: 'customer-2',
          startAt: new Date('2026-11-03T14:30:00Z'), // 14h30 às 15h30
        }),
      ).rejects.toThrow(SlotAlreadyTakenError);
    });

    it('permite um horário que começa exatamente quando o outro termina', async () => {
      const { useCase, bookings } = makeSut();
      await useCase.execute(validInput); // 14h às 15h

      await useCase.execute({
        ...validInput,
        customerId: 'customer-2',
        startAt: new Date('2026-11-03T15:00:00Z'), // 15h às 16h
      });

      expect(bookings.items).toHaveLength(2);
    });

    it('não bloqueia o horário de uma reserva cancelada', async () => {
      const { useCase, bookings } = makeSut();
      await bookings.save(
        Booking.restore({
          id: 'old-1',
          customerId: 'customer-9',
          providerId: 'provider-1',
          serviceId: 'service-1',
          timeSlot: TimeSlot.fromDuration(START, 60),
          price: Money.of(8000),
          status: 'CANCELLED',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          expiresAt: new Date('2026-11-01T10:15:00Z'),
        }),
      );

      const output = await useCase.execute(validInput);

      expect(output.status).toBe('PENDING_PAYMENT');
      expect(bookings.items).toHaveLength(2);
    });
  });
});