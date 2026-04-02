import { BadRequestException } from '@nestjs/common';

export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const FILE_INTERCEPTOR_OPTIONS = {
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
} as const;

const csvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

function startsWithSvg(buffer: Buffer) {
  const header = buffer.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
  return header.startsWith('<svg') || header.startsWith('<?xml');
}

export function detectImageMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length > 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (startsWithSvg(buffer)) {
    return 'image/svg+xml';
  }
  return null;
}

export function ensureFileProvided(file?: Express.Multer.File) {
  if (!file?.buffer || file.size <= 0) {
    throw new BadRequestException('Debes adjuntar un archivo.');
  }
}

export function ensureCsvFile(file?: Express.Multer.File) {
  ensureFileProvided(file);
  const upload = file as Express.Multer.File;
  const lowerName = upload.originalname.toLowerCase();
  const mime = (upload.mimetype || '').toLowerCase();
  const isCsvByName = lowerName.endsWith('.csv');
  const isCsvByMime = csvMimeTypes.has(mime);
  if (!isCsvByName && !isCsvByMime) {
    throw new BadRequestException('El archivo debe ser CSV.');
  }
}

export function ensureImageFile(file?: Express.Multer.File) {
  ensureFileProvided(file);
  const upload = file as Express.Multer.File;
  const detected = detectImageMimeTypeFromBuffer(upload.buffer);
  const mime = (upload.mimetype || '').toLowerCase();
  if (!detected) {
    throw new BadRequestException('El archivo no es una imagen valida.');
  }
  if (!imageMimeTypes.has(mime) && !imageMimeTypes.has(detected)) {
    throw new BadRequestException('Tipo de imagen no permitido.');
  }
  return detected;
}
