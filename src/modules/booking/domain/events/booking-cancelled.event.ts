import { CancelledBy } from '../shared/cancelled-by';
import { DomainEvent } from '../shared/domain-event';

export class BookingCancelledEvent implements DomainEvent {
  readonly name = 'BookingCancelled';
  readonly occurredAt: Date;

  constructor(
    readonly bookingId: string,
    readonly customerId: string,
    readonly providerId: string,
    readonly cancelledBy: CancelledBy,
    /** Quanto deve ser devolvido ao cliente. O contexto de Payment reage a isso. */
    readonly refundInCents: number,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt);
  }
}