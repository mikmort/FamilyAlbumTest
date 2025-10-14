import { NextRequest, NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/storage';
import { execute } from '@/lib/db';
import { generateImageThumbnail, getImageDimensions, fixImageOrientation, generateUniqueFilename } from '@/lib/utils';

// This API route handles file uploads
// POST /api/upload

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.name);
    const fileType = file.type.startsWith('image/') ? 1 : 2; // 1=image, 2=video

    // Fix orientation and get dimensions for images
    let processedBuffer = buffer;
    let width = 0;
    let height = 0;
    let thumbnailBuffer: Buffer;

    if (fileType === 1) {
      // Process image
      processedBuffer = await fixImageOrientation(buffer);
      const dimensions = await getImageDimensions(processedBuffer);
      width = dimensions.width;
      height = dimensions.height;

      // Generate thumbnail
      thumbnailBuffer = await generateImageThumbnail(processedBuffer);
    } else {
      // For videos, we'd need FFmpeg to extract thumbnail and get dimensions
      // This is a placeholder - implement video processing separately
      thumbnailBuffer = Buffer.from(''); // Placeholder
      width = 0;
      height = 0;
    }

    // Upload original file to blob storage
    const blobUrl = await uploadBlob(
      `media/${uniqueFilename}`,
      processedBuffer,
      file.type
    );

    // Upload thumbnail to blob storage
    const thumbnailUrl = await uploadBlob(
      `thumbnails/${uniqueFilename}`,
      thumbnailBuffer,
      'image/jpeg'
    );

    // Add to UnindexedFiles table
    const query = `
      INSERT INTO dbo.UnindexedFiles 
        (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl)
      VALUES 
        (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl)
    `;

    await execute(query, {
      fileName: uniqueFilename,
      directory: '',
      thumbUrl: thumbnailUrl,
      type: fileType,
      width,
      height,
      duration: 0, // For videos, extract with FFmpeg
      blobUrl,
    });

    return NextResponse.json({
      success: true,
      fileName: uniqueFilename,
      blobUrl,
      thumbnailUrl,
      width,
      height,
      type: fileType,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Configuration to allow larger files (Next.js 14+ route segment config)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Note: bodyParser size limit is handled by Next.js default of 4.5MB
// For larger files, consider using streaming or chunked uploads
