/**
 * @fileoverview Unified Query State Handler Hook
 *
 * Consolidates loading/error state handling for multiple TanStack queries.
 * Reduces boilerplate by handling common patterns of checking multiple query states.
 *
 * @example
 * const { renderState } = useQueryStates([
 *   { query: userQuery, name: 'user' },
 *   { query: teamQuery, name: 'team' }
 * ]);
 *
 * if (renderState) return renderState; // Returns loading or error UI
 * // Continue with component logic...
 */

import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';

interface QueryState {
  query: UseQueryResult<unknown, Error>;
  name: string;
  required?: boolean; // If true, null data returns error. Default: true
}

interface UseQueryStatesReturn {
  /**
   * React element to render if any query is loading or has error.
   * Returns null if all queries are successful.
   */
  renderState: ReactElement | null;

  /**
   * True if any query is currently loading
   */
  isLoading: boolean;
}

/**
 * Hook to consolidate loading/error handling for multiple TanStack queries
 *
 * Checks all provided queries and returns:
 * - Loading UI if any query is loading
 * - Error UI if any query has an error
 * - Error UI if any required query has null/undefined data
 * - null if all queries are successful
 *
 * @param queries - Array of query objects with their display names
 * @returns Object with renderState (JSX or null), isLoading, hasError
 */
export function useQueryStates(queries: QueryState[]): UseQueryStatesReturn {
  // Check if any query is loading
  const isLoading = queries.some((q) => q.query.isLoading);

  // Find first loading query
  if (isLoading) {
    return {
      renderState: <div>Loading...</div>,
      isLoading: true,
    };
  }

  // Find first query with error
  const errorQuery = queries.find((q) => q.query.error);
  if (errorQuery) {
    return {
      renderState: (
        <div>Error loading {errorQuery.name}: {errorQuery.query.error?.message}</div>
      ),
      isLoading: false,
    };
  }

  // Check for required data that's missing (null/undefined)
  const missingDataQuery = queries.find((q) => {
    const required = q.required !== undefined ? q.required : true; // Default to required
    return required && !q.query.data;
  });

  if (missingDataQuery) {
    return {
      renderState: <div>{missingDataQuery.name} not found</div>,
      isLoading: false,
    };
  }

  // All queries successful
  return {
    renderState: null,
    isLoading: false,
  };
}
