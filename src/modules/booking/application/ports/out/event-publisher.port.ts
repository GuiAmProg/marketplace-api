import { DomainEvent } from '../../../domain/shared/domain-event';

export interface EventPublisherPort {
  publishAll(events: DomainEvent[]): Promise<void>;
}