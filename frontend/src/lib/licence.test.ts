import { describe, expect, it } from "vitest";
import { checkLicenceText } from "./licence";

// Synthetic text shaped like OCR output; no real licence data.
describe("checkLicenceText", () => {
  it("accepts a driving licence with its number", () => {
    expect(checkLicenceText("Indian Union Driving Licence\nIssued by Government of Maharashtra\nMH12 20190001234\nName: TEST DRIVER").ok).toBe(true);
  });
  it("accepts a licence when the number is unreadable but the card fields are", () => {
    expect(checkLicenceText("INDIAN UNION DRIVING LICENSE  Issue Date 01-01-2020 Validity(NT) 01-01-2040").ok).toBe(true);
  });
  it("rejects other documents", () => {
    expect(checkLicenceText("GOVERNMENT OF INDIA  Date of Birth 01/01/1990  1234 5678 9012").ok).toBe(false); // ID card, no licence title
    expect(checkLicenceText("PERMANENT ACCOUNT NUMBER CARD  ABCDE1234F").ok).toBe(false);
    expect(checkLicenceText("Driving licence renewal form, please fill in").ok).toBe(false); // title only
    expect(checkLicenceText("").ok).toBe(false);
  });
});
