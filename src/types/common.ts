/**
 * Common type definitions and utility types
 * Provides type-safe foundations for the application
 */

/**
 * Result type for handling success/failure without exceptions
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Async result type alias
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  progress?: number; // 0-100
  message?: string;
}

/**
 * Error with user-friendly message
 */
export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  details?: unknown;
}

/**
 * Create an application error
 */
export function createAppError(
  code: string,
  message: string,
  userMessage?: string,
  details?: unknown
): AppError {
  return {
    code,
    message,
    userMessage: userMessage ?? 'An unexpected error occurred. Please try again.',
    details,
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  PDF_LOAD_FAILED: 'PDF_LOAD_FAILED',
  PDF_RENDER_FAILED: 'PDF_RENDER_FAILED',
  PDF_EXPORT_FAILED: 'PDF_EXPORT_FAILED',
  STORAGE_FAILED: 'STORAGE_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Geometry types for consistent coordinate handling
 */
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalized coordinates (0-1 range)
 */
export interface NormalizedPoint {
  x: number; // 0-1
  y: number; // 0-1
}

export interface NormalizedRect {
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1
}

/**
 * Brand types for stronger type safety
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type PageNumber = Brand<number, 'PageNumber'>;
export type AnnotationId = Brand<string, 'AnnotationId'>;

/**
 * Type guard for checking if a value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp to 0-1 range
 */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Debounce function with proper typing
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function with proper typing
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Safe JSON parse with type checking
 */
export function safeJsonParse<T>(json: string, validator?: (value: unknown) => value is T): Result<T, Error> {
  try {
    const parsed = JSON.parse(json);
    if (validator && !validator(parsed)) {
      return err(new Error('Invalid JSON structure'));
    }
    return ok(parsed as T);
  } catch (error) {
    return err(error instanceof Error ? error : new Error('Failed to parse JSON'));
  }
}
