/**
 * Dimension Normalization Utilities for PT Indah Kiat Pulp & Paper Tbk
 * Finish Pallet Management System (FPMS)
 */

/**
 * Normalizes any pallet dimension string into canonical compact format without spaces around 'x' or 'X'.
 * Guarantees that whether users type '81x111', '81 x 111', '81x 111', '81 x111', or '81X111',
 * they all collapse into the exact same canonical string '81x111'.
 *
 * Examples:
 * - "81 x 111"    -> "81x111"
 * - "81x 111"     -> "81x111"
 * - "81 x111"     -> "81x111"
 * - "81X111"      -> "81x111"
 * - " 86 x 122 "  -> "86x122"
 * - "2 x 10 x 125"-> "2x10x125"
 */
export function normalizePalletDimension(dim?: string | null): string {
  if (!dim) return '';
  return String(dim)
    .trim()
    .toLowerCase()
    .replace(/\s*([xX×*])\s*/g, 'x')
    .replace(/\s+/g, '');
}

/**
 * Compares two pallet dimensions regardless of spaces or casing
 */
export function isSamePalletDimension(a?: string | null, b?: string | null): boolean {
  return normalizePalletDimension(a) === normalizePalletDimension(b);
}

/**
 * Normalizes type pallet into uppercase "LS" or "SS"
 */
export function formatTypePallet(type?: string | null): string {
  if (!type) return 'LS';
  const s = String(type).trim().toUpperCase();
  if (s === 'SS' || s.includes('SHORT')) return 'SS';
  if (s === 'LS' || s.includes('LONG')) return 'LS';
  return s;
}

/**
 * Formats Jenis Pallet cleanly with Capitalized First Letters (Title Case)
 * e.g. "pallet reamwrap" -> "Pallet Reamwrap", "pallet sirkuLasi" -> "Pallet Sirkulasi"
 */
export function formatJenisPallet(jenis?: string | null): string {
  if (!jenis) return '-';
  const clean = String(jenis).trim();
  if (!clean) return '-';
  const lower = clean.toLowerCase();
  if (lower === 'rw' || lower === 'reamwrap') return 'Pallet Reamwrap';
  if (lower === 'bp' || lower === 'bulkpack') return 'Pallet Bulkpack';
  if (lower === 'rck' || lower === 'racuk') return 'Pallet Racuk';
  if (lower === 'srkls' || lower === 'sirkulasi') return 'Pallet Sirkulasi';
  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats market distribution cleanly into "Lokal" or "Ekspor"
 */
export function formatMarketType(market?: string | null): string {
  if (!market) return 'Lokal';
  const s = String(market).trim().toLowerCase();
  if (s === 'ekspor') return 'Ekspor';
  return 'Lokal';
}

/**
 * Formats quantity unit cleanly into "Set" or "Pcs"
 */
export function formatSatuan(unit?: string | null): string {
  if (!unit) return 'Set';
  const s = String(unit).trim().toLowerCase();
  if (s === 'pcs') return 'Pcs';
  return 'Set';
}

/**
 * Formats table cell text professionally for executive PDF and Excel reports:
 * - Ukuran Pallet -> "81x111", "86x122"
 * - Type Pallet -> "LS" atau "SS" (Huruf besar)
 * - Jenis Pallet -> "Pallet Reamwrap", "Pallet Bulkpack", "Pallet Racuk", "Pallet Sirkulasi" (Huruf kapital awal kata)
 * - Pasar / Lokal / Ekspor -> "Lokal" atau "Ekspor" (Huruf kapital awal)
 * - Satuan -> "Set" atau "Pcs" (Huruf kapital awal)
 * - Status Kesiapan -> "AMAN", "PERHATIAN", "KRITIS", "KOSONG" (Huruf kapital)
 * - Detail Kolom -> "C15 = 21, C16 = 1" (Format rapi tanpa lowercase)
 */
export function formatProfessionalCell(val: any, headerName?: string): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  const h = (headerName || '').toLowerCase();

  // 1. Pallet Runners (LS / SS)
  if (h.includes('runner') || h.includes('type') || str.toUpperCase() === 'LS' || str.toUpperCase() === 'SS') {
    return formatTypePallet(str);
  }

  // 2. Pallet Dimensions (e.g. 81x111, 81 x 111, 86 x 122)
  if (/^\d+(\.\d+)?\s*[xX×*]\s*\d+/.test(str)) {
    return normalizePalletDimension(str);
  }

  // 3. Region / Distribusi (Lokal / Ekspor)
  if (
    h.includes('region') ||
    h.includes('pasar') ||
    h.includes('lokal') ||
    h.includes('ekspor') ||
    h.includes('distribusi') ||
    str.toLowerCase() === 'lokal' ||
    str.toLowerCase() === 'ekspor'
  ) {
    return formatMarketType(str);
  }

  // 4. Satuan (Set / Pcs)
  if (
    h.includes('satuan') ||
    h.includes('unit') ||
    str.toLowerCase() === 'set' ||
    str.toLowerCase() === 'pcs'
  ) {
    return formatSatuan(str);
  }

  // 5. Wrap Type / Jenis Pallet (Pallet Reamwrap, Pallet Bulkpack, Pallet Racuk, Pallet Sirkulasi)
  if (h.includes('wrap') || h.includes('jenis') || str.toLowerCase().includes('pallet')) {
    return formatJenisPallet(str);
  }

  // 6. Status Kesiapan
  if (['aman', 'perhatian', 'kritis', 'kosong', 'habis'].includes(str.toLowerCase())) {
    return str.toUpperCase();
  }

  // 7. Detail Kolom (e.g. "c15 = 21, c16 = 1" -> "C15 = 21, C16 = 1")
  if (h.includes('kolom') || h.includes('peletakan')) {
    return str.replace(/\b([a-zA-Z])(\d+)\b/g, (_, letter, digits) => `${letter.toUpperCase()}${digits}`);
  }

  // 8. General lowercase text without numbers -> Capitalize first letter of each word
  if (str === str.toLowerCase() && !/\d/.test(str)) {
    return str
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return str;
}

/**
 * Validates whether a pallet specification for size 115x140 is allowed.
 * User instruction: "untuk ukuran 115x140 tidak perlu dikunci speknya harus racuk lokal ss pcs karena khawatirnya kedepannya ada ukuran yang sama tapi speknya berbeda"
 * All specifications for size 115x140 are now permitted dynamically, exactly like any other size.
 */
export function isAllowed115x140Spec(
  _palletSize?: string | null,
  _palletType?: string | null,
  _marketType?: string | null,
  _typePallet?: string | null,
  _unit?: string | null
): boolean {
  return true;
}


