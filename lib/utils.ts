import sharp from 'sharp';

/**
 * Generate a thumbnail from an image buffer
 */
export async function generateImageThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 300,
  maxHeight: number = 300
): Promise<Buffer> {
  return await sharp(imageBuffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Fix image orientation based on EXIF data
 */
export async function fixImageOrientation(imageBuffer: Buffer): Promise<Buffer> {
  return await sharp(imageBuffer).rotate().toBuffer();
}

/**
 * Convert image to JPEG format
 */
export async function convertToJpeg(imageBuffer: Buffer): Promise<Buffer> {
  return await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Generate a unique filename with timestamp
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const ext = originalFilename.split('.').pop();
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${sanitized}_${timestamp}.${ext}`;
}

/**
 * Check if file is a valid image
 */
export function isValidImage(filename: string): boolean {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = filename.toLowerCase().split('.').pop();
  return validExtensions.includes(`.${ext}`);
}

/**
 * Check if file is a valid video
 */
export function isValidVideo(filename: string): boolean {
  const validExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv'];
  const ext = filename.toLowerCase().split('.').pop();
  return validExtensions.includes(`.${ext}`);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format video duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse month name to number
 */
export function parseMonth(monthName: string): number | null {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const index = months.findIndex(m => m.startsWith(monthName.toLowerCase()));
  return index >= 0 ? index + 1 : null;
}

/**
 * Get month name from number
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}
