/**
 * Client-side utility functions
 * These functions are safe to use in browser/client components
 */

/**
 * Format a date string (YYYY-MM-DD) without timezone conversion
 * This prevents dates from shifting due to timezone differences
 */
export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  
  // Parse as date-only (YYYY-MM-DD) without timezone conversion
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return '—';
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${monthNames[month - 1]} ${day}, ${year}`;
}
