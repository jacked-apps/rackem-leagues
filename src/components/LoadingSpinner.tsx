/**
 * @fileoverview Loading Spinner Component
 *
 * Full-screen loading spinner shown while lazy-loading route components.
 */

export function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
