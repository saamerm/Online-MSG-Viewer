import PostalMime from 'postal-mime';
import { ParsedEmail, Attachment } from './msgParser';

export const parseEml = async (file: File): Promise<ParsedEmail> => {
  const parser = new PostalMime();
  const arrayBuffer = await file.arrayBuffer();
  const email = await parser.parse(arrayBuffer);

  // Extract Headers
  const headers = {
    subject: email.subject || "(No Subject)",
    from: email.from ? `${email.from.name} <${email.from.address}>` : "Unknown",
    to: email.to ? email.to.map(t => t.name || t.address) : [],
    cc: email.cc ? email.cc.map(c => c.name || c.address) : [],
    date: email.date ? new Date(email.date).toLocaleString() : "Unknown Date",
  };

  let body = email.html || email.text || "";

  // If no HTML, convert text to HTML (basic)
  if (!email.html && email.text) {
    body = email.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:underline">$1</a>')
      .replace(/\n/g, "<br>");
  }

  const attachments: Attachment[] = [];

  // Process Attachments & Inline Images
  if (email.attachments && email.attachments.length > 0) {
    email.attachments.forEach((att, index) => {
      const blob = new Blob([att.content], { type: att.mimeType });
      const url = URL.createObjectURL(blob);
      
      // contentId in postal-mime might be enclosed in <>
      const rawContentId = att.contentId;
      const contentId = rawContentId ? rawContentId.replace(/[<>]/g, '') : undefined;
      
      // Check if it's an inline image used in the body
      // EML often uses cid:contentId
      const isInline = !!contentId && (body.includes(`cid:${contentId}`) || body.includes(`cid:${rawContentId}`));

      attachments.push({
        fileName: att.filename || `attachment-${index + 1}`,
        contentId,
        url,
        size: att.content.byteLength,
        isInline
      });

      // Replace CID in body with Blob URL
      if (isInline && contentId) {
        const escapedCid = contentId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match src="cid:..." or src='cid:...' or src=cid:...
        const regex = new RegExp(`src=(["']?)cid:${escapedCid}\\1`, 'gi');
        body = body.replace(regex, `src="${url}"`);
      }
    });
  }

  return {
    headers,
    body,
    attachments: attachments.filter(a => !a.isInline)
  };
};
