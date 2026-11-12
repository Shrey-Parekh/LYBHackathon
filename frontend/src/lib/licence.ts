/*
  Is this text, read from a photo, an Indian driving licence? A deliberately shallow check: the card
  must say "driving licence" and show either a licence number (state code, RTO code, year, serial,
  for example MH12 20190001234) or one of the fields every licence card prints. It does not verify the
  licence with any authority. The text is used once and never stored or sent.
*/
const TITLE = /DRIV(?:ING|ER'?S)?\s*LICEN[CS]E/;
const NUMBER = /\b[A-Z]{2}[\s-]?\d{2}[\s-]?(?:19|20)\d{2}[\s-]?\d{7}\b/;
const FIELDS = /VALIDITY|DATE OF BIRTH|ISSUE DATE|DATE OF FIRST ISSUE|HOLDER'?S SIGNATURE/;

export interface LicenceCheck {
  ok: boolean;
  title: boolean;
  number: boolean;
  fields: boolean;
}

export function checkLicenceText(raw: string): LicenceCheck {
  const t = raw.toUpperCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  const title = TITLE.test(t);
  const number = NUMBER.test(t);
  const fields = FIELDS.test(t);
  return { ok: title && (number || fields), title, number, fields };
}
