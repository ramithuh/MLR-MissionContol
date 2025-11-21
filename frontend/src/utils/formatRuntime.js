/**
 * Format runtime in seconds to human-readable string.
 *
 * Examples:
 *   45 seconds -> "45s"
 *   90 seconds -> "1m 30s"
 *   3665 seconds -> "1h 1m"
 *   90000 seconds -> "1d 1h"
 *
 * @param {number|null} seconds - Runtime in seconds
 * @returns {string} Formatted runtime string, or "-" if null/undefined
 */
export function formatRuntime(seconds) {
  if (seconds === null || seconds === undefined) {
    return '-'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []

  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0 && days === 0) { // Don't show minutes if we're showing days
    parts.push(`${minutes}m`)
  }
  if (secs > 0 && days === 0 && hours === 0) { // Only show seconds if < 1 hour
    parts.push(`${secs}s`)
  }

  return parts.join(' ')
}
