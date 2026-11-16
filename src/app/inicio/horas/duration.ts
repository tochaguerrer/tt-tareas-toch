export function manualHoursToSeconds(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,2}(?:[.,](?:0|5))?$/.test(text)) return null;
  const hours = Number(text.replace(",", "."));
  return hours >= 0.5 && hours <= 24 ? hours * 3600 : null;
}

const decimalHours = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

export function formatDecimalHours(seconds: number, withUnit = true): string {
  return decimalHours.format(seconds / 3600) + (withUnit ? " h" : "");
}
