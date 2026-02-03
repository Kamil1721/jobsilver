/**
 * Email utility functions
 */

/**
 * Escape HTML special characters to prevent XSS attacks in email templates.
 * Must be used for any user-supplied data rendered in emails.
 */
export function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
