import MsgReader from '@kenjiuno/msgreader';
import { parseRtfToHtml } from './rtfParser';
import { deEncapsulateSync } from 'rtf-stream-parser';
import iconv from 'iconv-lite';
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
        
        // Try to get HTML from RTF first if available, as it might be cleaner than bodyHtml
        // (The user specifically requested using rtf-stream-parser for better results)
        let body = "";
        console.log("Attempting to parse RTF content for email body...");
        if (fileData.compressedRtf) {
          // const rtfBlob = decompressRTF(Array.from(fileData.compressedRtf));
          // const buffer = Buffer.from(rtfBlob)
          // const result = deEncapsulateSync(buffer, { decode: iconv.decode });
          try {
            let rtfContent = "";
            if (typeof fileData.compressedRtf === 'string'){
              console.log("fileData.compressedRtf is a string")
              rtfContent = fileData.compressedRtf;
            } else {
              const decompressed = decompressRTF(Array.from(fileData.compressedRtf))
              if (decompressed){
                const buffer = Buffer.from(decompressed)
                rtfContent = new TextDecoder().decode(buffer)
              } else {
                console.log("No decompressed")
              }
            }
            if (rtfContent){
              const rtfHtml = await parseRtfToHtml(rtfContent)
              if (rtfHtml) {
                body = rtfHtml
              }
            } else {
              console.log("No rtfContent")
            }
          } catch (err) {
            console.warn("Failed to parse RTF", err);
          }
        }

        // Fallback to existing bodyHtml or plain text if RTF parsing failed or wasn't HTML-encapsulated
        if (!body) {
          body = fileData.bodyHtml;
        }

        if (!body) {
          // If no HTML body, convert plain text to HTML
          const plainText = fileData.body || "";
          body = plainText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            // Linkify URLs
            .replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:underline">$1</a>')
            // Newlines to <br>
            .replace(/\n/g, "<br>");
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
