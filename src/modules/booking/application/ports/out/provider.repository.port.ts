import { TimeSlot } from '../../../domain/time-slot';

export interface ProviderView {
  id: string;
  userId: string;
  isAvailableFor(slot: TimeSlot): boolean;
}

export interface ProviderRepositoryPort {
  findById(id: string): Promise<ProviderView | null>;
}