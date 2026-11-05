import { CancellationPolicy } from './cancellation-policy';
import { BookingCancelledEvent } from './events/booking-cancelled.event';
import { BookingConfirmedEvent } from './events/booking-confirmed.event';
import { BookingRequestedEvent } from './events/booking-requested.event';
import { AggregateRoot } from './shared/aggregate-root';
import { CancelledBy } from './shared/cancelled-by';
import {
  BookingAlreadyStartedError,
  BookingInThePastError,
  InvalidBookingStateError,
} from './shared/domain-error';
import { Money } from './shared/money';
import { TimeSlot } from './time-slot';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'NO_SHOW';

// Estados em que a reserva ainda ocupa o horário do prestador.
const ACTIVE_STATUSES: readonly BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
];

export interface BookingProps {
  id: string;
  customerId: string;
  providerId: string;
  serviceId: string;
  timeSlot: TimeSlot;
  price: Money;
  /** Política vigente quando a reserva foi feita (snapshot). */
  cancellationPolicy: CancellationPolicy;
  status: BookingStatus;
  expiresAt: Date;
  createdAt: Date;
  cancelledAt?: Date;
  cancelledBy?: CancelledBy;
  refundAmount?: Money;
}

// O que é preciso informar para solicitar uma reserva nova.
// Status, prazo, data de criação e dados de cancelamento são decididos pelo Booking.
export type RequestBookingData = Omit<
  BookingProps,
  | 'status'
  | 'expiresAt'
  | 'createdAt'
  | 'cancelledAt'
  | 'cancelledBy'
  | 'refundAmount'
>;

export class Booking extends AggregateRoot {
  static readonly PAYMENT_WINDOW_MINUTES = 15;

  private readonly props: BookingProps;

  private constructor(props: BookingProps) {
    super();
    this.props = {
      ...props,
      createdAt: new Date(props.createdAt),
      expiresAt: new Date(props.expiresAt),
      cancelledAt: props.cancelledAt ? new Date(props.cancelledAt) : undefined,
    };
  }

  /** Cria uma reserva nova, aguardando pagamento. */
  static request(data: RequestBookingData, now: Date): Booking {
    if (data.timeSlot.hasStartedBy(now)) {
      throw new BookingInThePastError('Não é possível agendar no passado');
    }

    const expiresAt = new Date(
      now.getTime() + Booking.PAYMENT_WINDOW_MINUTES * 60_000,
    );

    const booking = new Booking({
      ...data,
      status: 'PENDING_PAYMENT',
      createdAt: now,
      expiresAt,
    });

    booking.record(
      new BookingRequestedEvent(
        data.id,
        data.customerId,
        data.providerId,
        now,
      ),
    );

    return booking;
  }

  /** Reconstrói uma reserva que já existia (vinda do banco). Não valida nem gera eventos. */
  static restore(props: BookingProps): Booking {
    return new Booking(props);
  }

  /** Transição PENDING_PAYMENT -> CONFIRMED (pagamento aprovado). */
  confirm(now: Date): void {
    if (this.props.status !== 'PENDING_PAYMENT') {
      throw new InvalidBookingStateError(
        `Só é possível confirmar uma reserva aguardando pagamento (status atual: ${this.props.status})`,
      );
    }

    this.props.status = 'CONFIRMED';
    this.record(
      new BookingConfirmedEvent(
        this.props.id,
        this.props.customerId,
        this.props.providerId,
        now,
      ),
    );
  }

  /**
   * Cancela a reserva e devolve o valor a ser reembolsado.
   * - Reserva não paga: nada a reembolsar.
   * - Cancelamento pelo prestador: reembolso integral.
   * - Cancelamento pelo cliente: conforme a política gravada na reserva.
   */
  cancel(by: CancelledBy, now: Date): Money {
    if (!this.isActive) {
      throw new InvalidBookingStateError(
        `Não é possível cancelar uma reserva com status ${this.props.status}`,
      );
    }
    if (this.props.timeSlot.hasStartedBy(now)) {
      throw new BookingAlreadyStartedError(
        'Não é possível cancelar uma reserva cujo horário já começou',
      );
    }

    const refund = this.calculateRefund(by, now);

    this.props.status = 'CANCELLED';
    this.props.cancelledAt = new Date(now);
    this.props.cancelledBy = by;
    this.props.refundAmount = refund;

    this.record(
      new BookingCancelledEvent(
        this.props.id,
        this.props.customerId,
        this.props.providerId,
        by,
        refund.amountInCents,
        now,
      ),
    );

    return refund;
  }

  private calculateRefund(by: CancelledBy, now: Date): Money {
    const zero = Money.of(0, this.props.price.currency);

    if (this.props.status !== 'CONFIRMED') return zero; // nada foi pago
    if (by === 'PROVIDER') return this.props.price; // culpa do prestador

    const percent = this.props.cancellationPolicy.refundPercentFor(
      this.props.timeSlot.start,
      now,
    );
    return this.props.price.percentage(percent);
  }

  get id(): string {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get providerId(): string {
    return this.props.providerId;
  }

  get serviceId(): string {
    return this.props.serviceId;
  }

  get timeSlot(): TimeSlot {
    return this.props.timeSlot;
  }

  get price(): Money {
    return this.props.price;
  }

  get cancellationPolicy(): CancellationPolicy {
    return this.props.cancellationPolicy;
  }

  get status(): BookingStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt ? new Date(this.props.cancelledAt) : null;
  }

  get cancelledBy(): CancelledBy | null {
    return this.props.cancelledBy ?? null;
  }

  get refundAmount(): Money | null {
    return this.props.refundAmount ?? null;
  }

  /** Verdadeiro enquanto a reserva ocupa o horário do prestador. */
  get isActive(): boolean {
    return ACTIVE_STATUSES.includes(this.props.status);
  }
}