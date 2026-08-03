/**
 * Safe Image Parsing & Formatting Helper
 * Accepts: null, undefined, single URL, single base64, JSON array string, or array of strings.
 * Returns: Array of image strings (max 5 items).
 */
export function parseImageUrls(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter(item => typeof item === 'string' && item.trim().length > 0).slice(0, 10);
  }
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    
    // Check if JSON array string
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => typeof item === 'string' && item.trim().length > 0).slice(0, 10);
        }
      } catch (e) {
        // Fallback to single string
      }
    }
    return [trimmed];
  }
  
  return [];
}

/**
 * Encodes an array of image URLs/base64 strings to DB format string.
 */
export function formatImagesForDb(imagesArray) {
  const valid = parseImageUrls(imagesArray);
  if (valid.length === 0) return null;
  return JSON.stringify(valid);
}
