export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  GROOMER = 'GROOMER',
  BARISTA = 'BARISTA',
  INVENTORY = 'INVENTORY',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum OrderType {
  RETAIL = 'RETAIL',
  CAFE = 'CAFE',
  MIXED = 'MIXED',
  GROOMING = 'GROOMING',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum FulfillmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  DINE_IN = 'DINE_IN',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  STRIPE = 'STRIPE',
  LOYALTY = 'LOYALTY',
  MIXED = 'MIXED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum ProductCategory {
  FOOD = 'FOOD',
  TREATS = 'TREATS',
  TOYS = 'TOYS',
  ACCESSORIES = 'ACCESSORIES',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
}

export enum MenuCategory {
  COFFEE = 'COFFEE',
  FOOD = 'FOOD',
  PET_TREATS = 'PET_TREATS',
  BEVERAGES = 'BEVERAGES',
  SPECIALS = 'SPECIALS',
}

export enum InventoryChangeReason {
  SALE = 'SALE',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
}

export enum NotificationType {
  BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
  BOOKING_REMINDER = 'BOOKING_REMINDER',
  BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  ORDER_READY = 'ORDER_READY',
  LOW_STOCK = 'LOW_STOCK',
  PROMOTION = 'PROMOTION',
  LOYALTY_EXPIRY = 'LOYALTY_EXPIRY',
}

export enum PetSpecies {
  DOG = 'DOG',
  CAT = 'CAT',
  OTHER = 'OTHER',
}

export const STAFF_ROLES: UserRole[] = [
  UserRole.GROOMER,
  UserRole.BARISTA,
  UserRole.INVENTORY,
  UserRole.MANAGER,
  UserRole.ADMIN,
];

export const ADMIN_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.ADMIN];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
