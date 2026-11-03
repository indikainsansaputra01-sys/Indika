/**
 * Finish Pallet Management System Logo Utility
 * Loads `/splash-pallet-logo.jpg` and caches it as base64 for embedding in PDF and Excel reports.
 */

let cachedLogoDataUrl: string | null = null;
let cachedLogoCleanBase64: string | null = null;

export async function getLogoBase64DataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return null;

  try {
    let res = await fetch('/splash-pallet-logo-transparent.png');
    if (!res.ok) {
      res = await fetch('/splash-pallet-logo.jpg');
    }
    if (!res.ok) return null;
    const blob = await res.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || null;
        cachedLogoDataUrl = result;
        if (result) {
          cachedLogoCleanBase64 = result.replace(/^data:image\/\w+;base64,/, '');
        }
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Unable to load splash-pallet-logo.jpg for report exports:', err);
    return null;
  }
}

export async function getLogoCleanBase64(): Promise<string | null> {
  if (cachedLogoCleanBase64) return cachedLogoCleanBase64;
  const dataUrl = await getLogoBase64DataUrl();
  if (!dataUrl) return null;
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

let cachedCompanyLogoDataUrl: string | null = null;
let cachedCompanyLogoCleanBase64: string | null = null;

export async function getCompanyLogoBase64DataUrl(): Promise<string | null> {
  if (cachedCompanyLogoDataUrl) return cachedCompanyLogoDataUrl;
  if (typeof window === 'undefined') return null;

  try {
    const res = await fetch('/assets/aistudio/PT_Indah_Kiat_Pulp___Paper_Tbk_-_Karir_Industri_5468d9cf.png');
    if (!res.ok) return null;
    const blob = await res.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || null;
        cachedCompanyLogoDataUrl = result;
        if (result) {
          cachedCompanyLogoCleanBase64 = result.replace(/^data:image\/\w+;base64,/, '');
        }
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Unable to load company logo for report exports:', err);
    return null;
  }
}

export async function getCompanyLogoCleanBase64(): Promise<string | null> {
  if (cachedCompanyLogoCleanBase64) return cachedCompanyLogoCleanBase64;
  const dataUrl = await getCompanyLogoBase64DataUrl();
  if (!dataUrl) return null;
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}
