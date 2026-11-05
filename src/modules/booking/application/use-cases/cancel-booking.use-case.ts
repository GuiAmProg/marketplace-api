import { Booking, BookingStatus } from '../../domain/booking';
import { CancelledBy } from '../../domain/shared/cancelled-by';
import { BookingNotFoundError } from '../errors/booking.errors';
import { BookingRepositoryPort } from '../ports/out/booking.repository.port';
import { ClockPort } from '../ports/out/clock.port';
import { EventPublisherPort } from '../ports/out/event-publisher.port';
import { ProviderRepositoryPort } from '../ports/out/provider.repository.port';

export interface CancelBookingInput {
  bookingId: string;
  /** Vem do token de autenticação, nunca do corpo da requisição. */
  requesterId: string;
}

export interface CancelBookingOutput {
  bookingId: string;
  status: BookingStatus;
  cancelledBy: CancelledBy;
  refundInCents: number;
}

export class CancelBookingUseCase {
  constructor(
    private readonly bookings: BookingRepositoryPort,
    private readonly providers: ProviderRepositoryPort,
    private readonly clock: ClockPort,
    private readonly events: EventPublisherPort,
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const now = this.clock.now();

    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) {
      throw new BookingNotFoundError('Reserva não encontrada');
    }

    const cancelledBy = await this.identifyRequester(booking, input.requesterId);
    if (!cancelledBy) {
      // Mesma resposta de "não existe": não revelamos reservas de terceiros.
      throw new BookingNotFoundError('Reserva não encontrada');
    }

    const refund = booking.cancel(cancelledBy, now);

    await this.bookings.save(booking);
    await this.events.publishAll(booking.pullEvents());

    return {
      bookingId: booking.id,
      status: booking.status,
      cancelledBy,
      refundInCents: refund.amountInCents,
    };
  }

  /** Descobre se quem pede é o cliente ou o prestador da reserva. Qualquer outro é nulo. */
  private async identifyRequester(
    booking: Booking,
    requesterId: string,
  ): Promise<CancelledBy | null> {
    if (booking.customerId === requesterId) return 'CUSTOMER';

    const provider = await this.providers.findById(booking.providerId);
    if (provider?.userId === requesterId) return 'PROVIDER';

    return null;
  }
}