import { InvalidTimeSlotError } from './shared/domain-error';

export class TimeSlot {
  private constructor(
    private readonly startMs: number,
    private readonly endMs: number,
  ) {}

  static create(start: Date, end: Date): TimeSlot {
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new InvalidTimeSlotError('As datas do horário devem ser válidas');
    }
    if (endMs <= startMs) {
      throw new InvalidTimeSlotError('O fim deve ser posterior ao início');
    }
    return new TimeSlot(startMs, endMs);
  }

  static fromDuration(start: Date, durationMinutes: number): TimeSlot {
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new InvalidTimeSlotError('A duração deve ser maior que zero');
    }
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return TimeSlot.create(start, end);
  }

  get start(): Date {
    return new Date(this.startMs);
  }

  get end(): Date {
    return new Date(this.endMs);
  }

  overlaps(other: TimeSlot): boolean {
    return this.startMs < other.endMs && other.startMs < this.endMs;
  }

  hasStartedBy(date: Date): boolean {
    return this.startMs <= date.getTime();
  }

  equals(other: TimeSlot): boolean {
    return this.startMs === other.startMs && this.endMs === other.endMs;
  }
}