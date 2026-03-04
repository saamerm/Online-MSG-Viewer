import { deEncapsulateSync } from 'rtf-stream-parser';
import * as iconv from 'iconv-lite';

export const parseRtfToHtml = async (rtfContent: string): Promise<string | null> => {
  if (!rtfContent) return null;
  
  try {
    // deEncapsulateSync extracts the HTML content from the RTF encapsulation
    // It requires a decode function to handle different character encodings
    console.log("Parsing RTF content...");
    const result = deEncapsulateSync(rtfContent, { decode: iconv.decode });
    return result.text;
  } catch (err) {
    console.warn("RTF De-encapsulation error", err);
    return null;
  }
};
