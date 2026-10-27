import { DomainError } from '../../domain/shared/domain-error';

export class ServiceNotFoundError extends DomainError {}
export class ServiceInactiveError extends DomainError {}
export class ProviderNotFoundError extends DomainError {}
export class ProviderUnavailableError extends DomainError {}
export class SelfBookingNotAllowedError extends DomainError {}
export class SlotAlreadyTakenError extends DomainError {}