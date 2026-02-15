export function formatDate(
  dateString: string,
  language: string,
  clockFormat: '12h' | '24h',
): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: clockFormat === '12h',
  });
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    return `${API_URL}${url}`;
  }
  return url;
}
