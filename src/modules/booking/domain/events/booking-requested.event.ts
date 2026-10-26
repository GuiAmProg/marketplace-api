import { DomainEvent } from '../shared/domain-event';

export class BookingRequestedEvent implements DomainEvent {
  readonly name = 'BookingRequested';
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