/**
 * Mock Supabase client for testing
 * Provides type-safe mocks for common Supabase operations
 */

import { vi } from 'vitest';

// Type for mock response data
interface MockResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

// Builder pattern for mocking Supabase queries
class MockQueryBuilder<T = unknown> {
  private response: MockResponse<T> = { data: null, error: null };

  constructor(private tableName: string) {}

  // Set the mock response
  mockResponse(data: T | null, error?: { message: string } | null): this {
    this.response = { data, error: error || null };
    return this;
  }

  mockCount(count: number): this {
    this.response.count = count;
    return this;
  }

  // Query methods - all return this for chaining
  select(_columns?: string): this {
    return this;
  }

  insert(_data: unknown): this {
    return this;
  }

  update(_data: unknown): this {
    return this;
  }

  upsert(_data: unknown, _options?: { onConflict?: string }): this {
    return this;
  }

  delete(): this {
    return this;
  }

  eq(_column: string, _value: unknown): this {
    return this;
  }

  neq(_column: string, _value: unknown): this {
    return this;
  }

  in(_column: string, _values: unknown[]): this {
    return this;
  }

  not(_column: string, _operator: string, _value: unknown): this {
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }): this {
    return this;
  }

  limit(_count: number): this {
    return this;
  }

  // Terminal methods - return the response
  single(): Promise<MockResponse<T>> {
    return Promise.resolve(this.response);
  }

  async then<TResult>(
    onfulfilled?: ((value: MockResponse<T>) => TResult | PromiseLike<TResult>) | null
  ): Promise<TResult> {
    const result = await Promise.resolve(this.response);
    return onfulfilled ? onfulfilled(result) : (result as unknown as TResult);
  }
}

// Mock Supabase client
class MockSupabaseClient {
  private tableResponses: Map<string, MockResponse<unknown>> = new Map();
  private queryBuilders: Map<string, MockQueryBuilder> = new Map();

  // Set expected response for a table
  setMockResponse<T>(table: string, data: T | null, error?: { message: string } | null): void {
    this.tableResponses.set(table, { data, error: error || null });
  }

  // Get or create a query builder for a table
  from(table: string): MockQueryBuilder {
    const builder = new MockQueryBuilder(table);
    const response = this.tableResponses.get(table);
    if (response) {
      builder.mockResponse(response.data, response.error);
    }
    this.queryBuilders.set(table, builder);
    return builder;
  }

  // Mock channel for realtime subscriptions
  channel(_name: string) {
    return {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
  }

  removeChannel(_channel: unknown): void {
    // No-op
  }
}

// Singleton instance
let mockClient: MockSupabaseClient | null = null;

/**
 * Get the mock Supabase client
 */
export function getMockSupabase(): MockSupabaseClient {
  if (!mockClient) {
    mockClient = new MockSupabaseClient();
  }
  return mockClient;
}

/**
 * Reset the mock Supabase client
 * Call this in beforeEach to reset state between tests
 */
export function resetMockSupabase(): void {
  mockClient = new MockSupabaseClient();
}

/**
 * Create a mock Supabase response
 */
export function createMockResponse<T>(
  data: T | null,
  error?: { message: string } | null
): MockResponse<T> {
  return { data, error: error || null };
}

/**
 * Mock the getSupabase function from the supabase module
 */
export const mockGetSupabase = vi.fn(() => getMockSupabase());
