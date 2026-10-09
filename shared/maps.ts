/** Google Maps / Apple Maps URLs for a free-text location (no API key needed). */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query.trim());
  return {
    embed: `https://www.google.com/maps?q=${q}&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    /** Google Maps place search, e.g. ?api=1&query=25+Hollywood+St,+Worcester,+MA+01610 */
    search: `https://www.google.com/maps/search/?api=1&query=${q.replace(/%20/g, '+').replace(/%2C/g, ',')}`,
    apple: `https://maps.apple.com/?daddr=${q}`,
  };
}

/** First line of an address ("25 Hollywood St, Worcester, MA" → "25 Hollywood St"). */
export function streetLine(address: string) {
  return address.split(',')[0].trim();
}
