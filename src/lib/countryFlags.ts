// Map of country names to ISO 3166-1 alpha-2 codes
const countryToCode: Record<string, string> = {
  // Common countries
  'USA': 'US',
  'United States': 'US',
  'UK': 'GB',
  'United Kingdom': 'GB',
  'Germany': 'DE',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Canada': 'CA',
  'Australia': 'AU',
  'Japan': 'JP',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'India': 'IN',
  'China': 'CN',
  'Russia': 'RU',
  'Korea': 'KR',
  'South Korea': 'KR',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Poland': 'PL',
  'Ukraine': 'UA',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Finland': 'FI',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Switzerland': 'CH',
  'Austria': 'AT',
  'Denmark': 'DK',
  'Ireland': 'IE',
  'Portugal': 'PT',
  'Greece': 'GR',
  'Argentina': 'AR',
  'Chile': 'CL',
  'Colombia': 'CO',
  'Peru': 'PE',
  'Venezuela': 'VE',
  'Philippines': 'PH',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'Singapore': 'SG',
  'New Zealand': 'NZ',
  'South Africa': 'ZA',
  'Egypt': 'EG',
  'Turkey': 'TR',
  'Saudi Arabia': 'SA',
  'UAE': 'AE',
  'United Arab Emirates': 'AE',
  'Israel': 'IL',
  'Czech Republic': 'CZ',
  'Romania': 'RO',
  'Hungary': 'HU',
  'Bulgaria': 'BG',
  'Croatia': 'HR',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Serbia': 'RS',
  'Unknown': '',
};

/**
 * Convert a country code to a flag emoji
 * Uses regional indicator symbols to create flag emojis
 */
function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

/**
 * Get flag emoji for a country name
 * Returns empty string if country is not found
 */
export function getCountryFlag(country: string): string {
  const code = countryToCode[country];
  if (!code) return '';
  return codeToFlag(code);
}

/**
 * Format country with flag emoji
 * Example: "Brazil" -> "🇧🇷 Brazil"
 */
export function formatCountryWithFlag(country: string): string {
  const flag = getCountryFlag(country);
  if (!flag) return country;
  return `${flag} ${country}`;
}
