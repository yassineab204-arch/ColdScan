export const EXCHANGE_RATES_TO_DH: Record<string, number> = {
  'DH': 1.0,
  'MAD': 1.0,
  '$': 9.50,
  'USD': 9.50,
  '€': 10.45,
  'EUR': 10.45,
  '£': 12.35,
  'GBP': 12.35,
  '¥': 0.062,
  'JPY': 0.062,
};

export function getRateToDH(currencyCode: string): number {
  if (!currencyCode) return 1.0;
  const cleanCode = currencyCode.trim();
  return EXCHANGE_RATES_TO_DH[cleanCode] || 1.0;
}

/**
 * Converts an amount from one currency to another accurately.
 * Real-life conversion baseline: 1 USD ($) = 9.5 Moroccan Dirhams (DH / MAD).
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  const fromCode = fromCurrency || 'DH';
  const toCode = toCurrency || 'DH';

  if (fromCode === toCode) return amount;

  // Convert source amount to base DH (Dirhams)
  const rateFromToDH = getRateToDH(fromCode);
  const amountInDH = amount * rateFromToDH;

  // Convert base DH to target currency
  const rateTargetToDH = getRateToDH(toCode);
  return amountInDH / rateTargetToDH;
}

/**
 * Formats a number with currency symbol or code.
 */
export function formatCurrencyAmount(amount: number, currency: string = 'DH'): string {
  const cleanCode = (currency || 'DH').trim();
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const formatted = val.toFixed(2);

  if (cleanCode === '$' || cleanCode === 'USD') {
    return `$${formatted}`;
  }
  if (cleanCode === '€' || cleanCode === 'EUR') {
    return `€${formatted}`;
  }
  if (cleanCode === '£' || cleanCode === 'GBP') {
    return `£${formatted}`;
  }
  if (cleanCode === '¥' || cleanCode === 'JPY') {
    return `¥${Math.round(val)}`;
  }

  return `${formatted} ${cleanCode}`;
}
