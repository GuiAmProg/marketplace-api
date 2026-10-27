import { Booking, BookingStatus } from '../../domain/booking';
import { TimeSlot } from '../../domain/time-slot';
import {
  ProviderNotFoundError,
  ProviderUnavailableError,
  SelfBookingNotAllowedError,
  ServiceInactiveError,
  ServiceNotFoundError,
  SlotAlreadyTakenError,
} from '../errors/booking.errors';
import { BookingRepositoryPort } from '../ports/out/booking.repository.port';
import { ClockPort } from '../ports/out/clock.port';
import { EventPublisherPort } from '../ports/out/event-publisher.port';
import { IdGeneratorPort } from '../ports/out/id-generator.port';
import { ProviderRepositoryPort } from '../ports/out/provider.repository.port';
import { ServiceRepositoryPort } from '../ports/out/service.repository.port';

export interface RequestBookingInput {
  /** Vem do token de autenticação, nunca do corpo da requisição. */
  customerId: string;
  serviceId: string;
  startAt: Date;
}

export interface RequestBookingOutput {
  bookingId: string;
  status: BookingStatus;
  priceInCents: number;
  expiresAt: Date;
}

export class RequestBookingUseCase {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly services: ServiceRepositoryPort,
    private readonly providers: ProviderRepositoryPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly events: EventPublisherPort,
  ) {}

  async execute(input: RequestBookingInput): Promise<RequestBookingOutput> {
    const now = this.clock.now();

    const service = await this.services.findById(input.serviceId);
    if (!service) {
      throw new ServiceNotFoundError('Serviço não encontrado');
    }
    if (!service.active) {
      throw new ServiceInactiveError('Serviço indisponível');
    }

    const provider = await this.providers.findById(service.providerId);
    if (!provider) {
      throw new ProviderNotFoundError('Prestador não encontrado');
    }
    if (provider.userId === input.customerId) {
      throw new SelfBookingNotAllowedError(
        'O prestador não pode agendar o próprio serviço',
      );
    }

    const slot = TimeSlot.fromDuration(input.startAt, service.durationMinutes);

    if (!provider.isAvailableFor(slot)) {
      throw new ProviderUnavailableError(
        'O horário está fora da jornada do prestador',
      );
    }
    if (await this.bookings.existsActiveOverlap(provider.id, slot)) {
      throw new SlotAlreadyTakenError('O horário já está reservado');
    }

    const booking = Booking.request(
      {
        id: this.ids.generate(),
        customerId: input.customerId,
        providerId: provider.id,
        serviceId: service.id,
        timeSlot: slot,
        price: service.price,
      },
      now,
    );

    await this.bookings.save(booking);
    await this.events.publishAll(booking.pullEvents());

    return {
      bookingId: booking.id,
      status: booking.status,
      priceInCents: booking.price.amountInCents,
      expiresAt: booking.expiresAt,
    };
  }
}