/**
 * Formats market intelligence dispatch dates to standard US Eastern Time (ET)
 * with clean, professional fintech presentation (e.g. "Oct 9, 2026 · 8:06 PM ET" or "Aug 25, 2026").
 */
export function formatMarketDate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return '';
  const str = String(dateInput).trim();

  // If purely YYYY-MM-DD (e.g. legacy archive posts "2026-08-25")
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  }

  // Parse ISO or standard date formats
  let d = new Date(str);
  if (isNaN(d.getTime())) {
    // If format is like "2026-10-10 00:06 UTC"
    const utcMatch = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*UTC$/i);
    if (utcMatch) {
      d = new Date(`${utcMatch[1]}T${utcMatch[2]}:00Z`);
    }
  }

  if (isNaN(d.getTime())) {
    return str;
  }

  // Convert to US Eastern Time (US equity market standard)
  const datePart = d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const timePart = d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${datePart} · ${timePart} ET`;
}
