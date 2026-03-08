import MsgReader from '@kenjiuno/msgreader';
import { parseRtfToHtml } from './rtfParser';
import { decompressRTF } from '@kenjiuno/decompressrtf';
import { Buffer } from 'buffer';
export interface Attachment {
  fileName: string;
  contentId?: string;
  url: string;
  size: number;
  isInline: boolean;
}

export interface ParsedEmail {
  headers: {
    subject: string;
    from: string;
    to: string[];
    cc: string[];
    date: string;
  };
  body: string; // HTML or Text
  attachments: Attachment[];
}

export const parseMsg = async (file: File): Promise<ParsedEmail> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = async function (e) {
      if (!e.target || !e.target.result) {
        reject(new Error("Failed to read file"));
        return;
      }

      const buffer = e.target.result as ArrayBuffer;
      try {
        const msgReader = new MsgReader(buffer);
        const fileData = msgReader.getFileData();

        if (!fileData) {
          reject(new Error("Invalid MSG file data"));
          return;
        }

        // Extract Headers
        const headers = {
          subject: fileData.subject || "(No Subject)",
          from: fileData.senderName ? `${fileData.senderName} <${fileData.senderEmail}>` : fileData.senderEmail || "Unknown",
          to: fileData.recipients ? fileData.recipients.filter(r => r.recipType === 'to').map(r => r.name || r.email) : [],
          cc: fileData.recipients ? fileData.recipients.filter(r => r.recipType === 'cc').map(r => r.name || r.email) : [],
          date: fileData.messageDeliveryTime ? new Date(fileData.messageDeliveryTime).toLocaleString() : "Unknown Date",
        };

        // Process Attachments & Inline Images
        const attachments: Attachment[] = [];
        
        // Try to get HTML from RTF first (Outlook often stores HTML inside compressed RTF with encapsulation).
        // Pass Buffer to parser so it can use the RTF's codepage (e.g. ansicpg1252) instead of assuming UTF-8.
        let body = "";

        if (fileData.compressedRtf) {
          try {
            let rtfInput: string | Buffer | Uint8Array;
            if (typeof fileData.compressedRtf === 'string') {
              rtfInput = fileData.compressedRtf;
            } else {
              const decompressed = decompressRTF(Array.from(fileData.compressedRtf));
              if (decompressed) {
                rtfInput = Buffer.from(decompressed);
              } else {
                rtfInput = "";
              }
            }
            if (rtfInput) {
              const rtfHtml = await parseRtfToHtml(rtfInput);
              if (rtfHtml?.trim()) body = rtfHtml;
            }
          } catch (err) {
            console.warn("Failed to parse RTF", err);
          }
        }

        // Fallback to HTML body if the library extracted it (e.g. PR_HTML / bodyHtml or html property)
        // Note: PR_HTML (0x10130102) is stored as BINARY in MSG - the library returns raw bytes, not a string
        if (!body?.trim()) {
          const htmlRaw = fileData.bodyHtml ?? (fileData as { html?: string | Uint8Array | Buffer | number[] }).html;
          if (htmlRaw != null) {
            if (typeof htmlRaw === 'string' && htmlRaw.trim()) {
              body = htmlRaw;
            } else {
              // PR_HTML (0x10130102) is stored as BINARY - library returns raw bytes
              const bytes =
                htmlRaw instanceof Uint8Array
                  ? htmlRaw
                  : htmlRaw instanceof ArrayBuffer
                    ? new Uint8Array(htmlRaw)
                    : Buffer.isBuffer(htmlRaw)
                      ? new Uint8Array(htmlRaw)
                      : Array.isArray(htmlRaw)
                        ? new Uint8Array(htmlRaw)
                        : null;
              if (bytes && bytes.length > 0) {
                body = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                if (!body?.trim()) body = "";
              }
            }
          }
        }

        if (!body?.trim()) {
          const plainText = fileData.body || "";
          if (plainText.trim()) {
            body = plainText
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;")
              .replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:underline">$1</a>')
              .replace(/\n/g, "<br>");
          } else {
            body = '<p style="color: #999; font-style: italic;">This email has no body content.</p>';
          }
        }

        if (fileData.attachments && fileData.attachments.length > 0) {
          fileData.attachments.forEach((att, index) => {
            const attachmentData = msgReader.getAttachment(index) as any;
            if (!attachmentData) return;

            const blob = new Blob([attachmentData.content], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            
            // The library might return contentId or pidContentId, handle both
            const rawContentId = attachmentData.contentId || attachmentData.pidContentId;
            const contentId = rawContentId ? rawContentId.replace(/[<>]/g, '') : undefined;
            
            const isInline = !!contentId && body.includes(`cid:${contentId}`);

            attachments.push({
              fileName: attachmentData.fileName || `attachment-${index + 1}`,
              contentId,
              url,
              size: attachmentData.contentLength || attachmentData.attachSize || blob.size,
              isInline
            });

            // Replace CID in body with Blob URL
            if (isInline && contentId) {
              // Regex to replace cid:contentId with the blob URL
              // Handle both quoted and unquoted attributes, and potential variations
              const escapedCid = contentId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
              
              // Match src="cid:..." or src='cid:...' or src=cid:...
              const regex = new RegExp(`src=(["']?)cid:${escapedCid}\\1`, 'gi');
              body = body.replace(regex, `src="${url}"`);
            }
          });
        }

        resolve({
          headers,
          body,
          attachments: attachments.filter(a => !a.isInline) // Only return non-inline attachments for the list
        });

      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = (e) => reject(e);
    fileReader.readAsArrayBuffer(file);
  });
};
