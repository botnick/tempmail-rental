/**
 * Email content decoding utilities
 * Shared across MailboxList and MessageViewContent
 */

/**
 * RFC 2047 MIME encoded-word decoder
 * Handles old DB subjects like =?UTF-8?B?...?= or =?UTF-8?Q?...?=
 */
export function decodeMIME(str: string): string {
  if (!str || !str.includes('=?')) return str;
  try {
    return str
      .replace(
        /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi,
        (match: string, charset: string, encoding: string, data: string) => {
          if (encoding.toUpperCase() === 'B') {
            // Base64 encoded
            const bytes = atob(data);
            const uint8 = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) uint8[i] = bytes.charCodeAt(i);
            return new TextDecoder(charset).decode(uint8);
          } else {
            // Quoted-Printable encoded
            const decoded = data
              .replace(/_/g, ' ')
              .replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) => {
                return String.fromCharCode(parseInt(hex, 16));
              });
            const uint8 = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) uint8[i] = decoded.charCodeAt(i);
            return new TextDecoder(charset).decode(uint8);
          }
        },
      )
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return str;
  }
}

/** Check if content looks like HTML */
export function looksLikeHtml(content: string): boolean {
  return /<\s*(html|body|div|p|table|br|img|a|span|head)\b/i.test(content);
}

/**
 * Decode a base64 string to UTF-8 text.
 * atob() returns Latin-1 binary string — multi-byte UTF-8 chars (Thai, CJK, etc.)
 * get garbled unless we pipe through Uint8Array → TextDecoder.
 */
function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Detect and decode base64-encoded content */
export function tryDecodeBase64(content: string): string {
  if (!content) return content;
  const trimmed = content.trim();
  // Check if it looks like base64 (only valid base64 chars, length > 100, no HTML tags)
  if (trimmed.length > 100 && /^[A-Za-z0-9+/\s=]+$/.test(trimmed) && !/</.test(trimmed)) {
    try {
      const decoded = base64ToUtf8(trimmed.replace(/\s/g, ''));
      // Verify the decoded result contains readable text (no binary control chars)
      if (decoded.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(decoded.slice(0, 200))) {
        return decoded;
      }
    } catch {
      /* not valid base64 */
    }
  }
  return content;
}
