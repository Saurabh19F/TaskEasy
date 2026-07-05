import { registerAs } from '@nestjs/config';

export default registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  apiKey: process.env.CLOUDINARY_API_KEY ?? '',
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? 'taskeasy',
  folder: process.env.CLOUDINARY_FOLDER ?? 'taskeasy',
}));
