import { DomainEvent } from '../shared/domain-event';

export class BookingConfirmedEvent implements DomainEvent {
  readonly name = 'BookingConfirmed';
  readonly occurredAt: Date;

  constructor(
    readonly bookingId: string,
    readonly customerId: string,
    readonly providerId: string,
    occurredAt: Date,
  ) {
    this.occurredAt = new Date(occurredAt);
  }
}