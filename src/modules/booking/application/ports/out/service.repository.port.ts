import { CancellationPolicy } from '../../../domain/cancellation-policy';
import { Money } from '../../../domain/shared/money';

export interface ServiceView {
  id: string;
  providerId: string;
  durationMinutes: number;
  price: Money;
  cancellationPolicy: CancellationPolicy;
  active: boolean;
}

export interface ServiceRepositoryPort {
  findById(id: string): Promise<ServiceView | null>;
}