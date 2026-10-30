export function whatsappLink(raw: string) {
  let digits = raw.replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
export function mapsLink(address: string, city: string) {
  const query = [address.trim(), city.trim()].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}
