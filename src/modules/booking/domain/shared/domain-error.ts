export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidMoneyError extends DomainError {}
export class InvalidTimeSlotError extends DomainError {}
export class BookingInThePastError extends DomainError {}
export class InvalidCancellationPolicyError extends DomainError {}
export class InvalidBookingStateError extends DomainError {}
export class BookingAlreadyStartedError extends DomainError {}

