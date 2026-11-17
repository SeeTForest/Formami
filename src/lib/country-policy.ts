/** Product reporting policy. Keep original GeoIP/region data intact. */
export function reportingCountry<T extends string | null | undefined>(country: T): T {
  return (country?.toUpperCase() === 'TW' ? 'CN' : country) as T;
}

/** Only pass source-controlled column expressions, never request input. */
export function countrySQL(column = 'country') {
  return `case when ${column} = 'TW' then 'CN' else ${column} end`;
}

export function countryFilterValue(value: any, operator: string) {
  // Legacy equality filters for TW become aliases for the reporting country.
  // Pattern operators intentionally operate on the canonical country code.
  if (operator !== 'eq' && operator !== 'neq') return value;
  return Array.isArray(value) ? value.map(reportingCountry) : reportingCountry(value);
}

/** Normalize dimension fields, without touching arbitrary event properties. */
export function reportingCountryRows<T>(result: T): T {
  if (Array.isArray(result)) return result.map(reportingCountryRows) as T;
  if (!result || typeof result !== 'object' || result instanceof Date) return result;
  const row = result as Record<string, any>;
  return {
    ...row,
    ...('country' in row ? { country: reportingCountry(row.country) } : {}),
    ...(Array.isArray(row.data) ? { data: row.data.map(reportingCountryRows) } : {}),
  } as T;
}
