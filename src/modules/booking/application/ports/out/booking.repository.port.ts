import { Booking } from '../../../domain/booking';
import { TimeSlot } from '../../../domain/time-slot';

export interface BookingRepositoryPort {
  save(booking: Booking): Promise<void>;
  findById(id: string): Promise<Booking | null>;
  existsActiveOverlap(providerId: string, slot: TimeSlot): Promise<boolean>;
}