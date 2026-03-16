import NepaliDate from 'nepali-date-converter';

export function adToBs(adDate: string | Date): string {
  try {
    const d = new Date(adDate);
    const nepaliDate = new NepaliDate(d);
    return nepaliDate.format('YYYY-MM-DD');
  } catch (e) {
    return '';
  }
}

export function bsToAd(bsDate: string): string {
  try {
    const nepaliDate = new NepaliDate(bsDate);
    const adDate = nepaliDate.toJsDate();
    const year = adDate.getFullYear();
    const month = String(adDate.getMonth() + 1).padStart(2, '0');
    const day = String(adDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}

export function getCurrentBsDate(): string {
  return new NepaliDate().format('YYYY-MM-DD');
}

export function getTodayBs(): string {
  return getCurrentBsDate();
}
