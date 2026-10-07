/** Google Maps / Apple Maps URLs for a free-text location (no API key needed). */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query.trim());
  return {
    embed: `https://www.google.com/maps?q=${q}&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?daddr=${q}`,
  };
}
