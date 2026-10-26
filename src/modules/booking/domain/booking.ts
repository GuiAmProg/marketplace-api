import { BookingRequestedEvent } from './events/booking-requested.event';
import { AggregateRoot } from './shared/aggregate-root';
import { BookingInThePastError } from './shared/domain-error';
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
  status: BookingStatus;
  expiresAt: Date;
  createdAt: Date;
}

// O que é preciso informar para solicitar uma reserva nova.
// Status, prazo e data de criação são decididos pelo próprio Booking.
export type RequestBookingData = Omit<
  BookingProps,
  'status' | 'expiresAt' | 'createdAt'
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

  get status(): BookingStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  /** Verdadeiro enquanto a reserva ocupa o horário do prestador. */
  get isActive(): boolean {
    return ACTIVE_STATUSES.includes(this.props.status);
  }
}