import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadOptions {
  folder?: string;
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'pad' | 'crop' | 'thumb' | 'scale';
  gravity?: string;
  quality?: 'auto' | number;
}

/**
 * Upload an image to Cloudinary from a base64 string
 * @param base64String - Base64 encoded image string (without data: prefix)
 * @param fileName - Original file name for reference
 * @param options - Upload options with transformations
 * @returns Object with imageUrl and publicId
 */
export async function uploadImageToCloudinary(
  base64String: string,
  fileName: string,
  options: UploadOptions = {}
): Promise<{ imageUrl: string; publicId: string }> {
  try {
    // Remove 'data:*;base64,' prefix if present
    const cleanBase64 = base64String.includes(',')
      ? base64String.split(',')[1]
      : base64String;

    const isDev = process.env.NODE_ENV !== 'production';

    const uploadOptions: any = {
      resource_type: 'image',
      folder: (isDev ? 'dev/' : '') + (options.folder || 'acs/cards'),
      public_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      overwrite: false,
      unique_filename: true,
    };

    // Add transformations if specified
    // if (options.width || options.height) {
    //   uploadOptions.transformation = [
    //     {
    //       width: options.width,
    //       height: options.height,
    //       crop: options.crop || 'fill',
    //       quality: options.quality || 'auto',
    //     },
    //   ];
    // }

    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${cleanBase64}`,
      uploadOptions
    );

    return {
      imageUrl: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload image to Cloudinary: ${error}`);
  }
}

/**
 * Upload a card image with default transformations (250x378)
 */
export async function uploadCardImage(
  base64String: string,
  fileName: string
): Promise<{ imageUrl: string; publicId: string }> {
  return uploadImageToCloudinary(base64String, fileName, {
    folder: 'acs/cards/main',
    height: 378,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
  });
}

/**
 * Upload a card asset image (background/border) with proportional resizing
 */
export async function uploadCardAssetImage(
  base64String: string,
  fileName: string,
  assetType: 'background' | 'border'
): Promise<{ imageUrl: string; publicId: string }> {
  const folder = assetType === 'background'
    ? 'acs/cards/assets/backgrounds'
    : 'acs/cards/assets/borders';

  return uploadImageToCloudinary(base64String, fileName, {
    folder,
    height: 378,
    crop: 'limit', // Keep aspect ratio, max 400x400
    quality: 'auto',
  });
}

/**
 * Delete an image from Cloudinary by public ID
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image from Cloudinary: ${error}`);
  }
}

/**
 * Get all main card images from Cloudinary
 */
export async function getMainCardImages(): Promise<Array<{ publicId: string; url: string; secure_url: string }>> {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    const folder = isDev ? 'dev/acs/cards/main' : 'acs/cards/main';

    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 500,
    });

    return result.resources.map((resource: any) => ({
      publicId: resource.public_id,
      url: resource.url,
      secure_url: resource.secure_url,
    }));
  } catch (error) {
    console.error('Cloudinary fetch error:', error);
    throw new Error(`Failed to fetch images from Cloudinary: ${error}`);
  }
}
