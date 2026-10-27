import { Booking } from '../domain/booking';
import { DomainEvent } from '../domain/shared/domain-event';
import { TimeSlot } from '../domain/time-slot';
import { BookingRepositoryPort } from '../application/ports/out/booking.repository.port';
import { ClockPort } from '../application/ports/out/clock.port';
import { EventPublisherPort } from '../application/ports/out/event-publisher.port';
import { IdGeneratorPort } from '../application/ports/out/id-generator.port';
import {
  ProviderRepositoryPort,
  ProviderView,
} from '../application/ports/out/provider.repository.port';
import {
  ServiceRepositoryPort,
  ServiceView,
} from '../application/ports/out/service.repository.port';

export class InMemoryBookingRepository implements BookingRepositoryPort {
  items: Booking[] = [];

  async save(booking: Booking): Promise<void> {
    this.items = this.items.filter((item) => item.id !== booking.id);
    this.items.push(booking);
  }

  async findById(id: string): Promise<Booking | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async existsActiveOverlap(
    providerId: string,
    slot: TimeSlot,
  ): Promise<boolean> {
    return this.items.some(
      (item) =>
        item.providerId === providerId &&
        item.isActive &&
        item.timeSlot.overlaps(slot),
    );
  }
}

export class InMemoryServiceRepository implements ServiceRepositoryPort {
  constructor(private readonly items: ServiceView[] = []) {}

  async findById(id: string): Promise<ServiceView | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
}

export class InMemoryProviderRepository implements ProviderRepositoryPort {
  constructor(private readonly items: ProviderView[] = []) {}

  async findById(id: string): Promise<ProviderView | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
}

export class FixedClock implements ClockPort {
  constructor(private readonly current: Date) {}

  now(): Date {
    return new Date(this.current);
  }
}

export class SequentialIdGenerator implements IdGeneratorPort {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export class SpyEventPublisher implements EventPublisherPort {
  published: DomainEvent[] = [];

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}