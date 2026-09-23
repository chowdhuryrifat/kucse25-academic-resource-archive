import JSZip from 'jszip';
import { OptimizationResult } from '../types';

export const FILE_LIMITS = {
  MAX_INPUT_BYTES: 25 * 1024 * 1024, // 25 MB max initial input
  PDF_ORIGINAL_LIMIT: 20 * 1024 * 1024, // 20 MB max original input
  PDF_STORED_LIMIT: 10 * 1024 * 1024, // 10 MB stored limit
  PPTX_LIMIT: 15 * 1024 * 1024, // 15 MB
  DOCX_LIMIT: 15 * 1024 * 1024, // 15 MB
  IMAGE_LIMIT: 10 * 1024 * 1024, // 10 MB
};

export type ProgressCallback = (message: string, percent?: number) => void;

/**
 * Calculates cryptographic SHA-256 hex string using browser native Web Crypto API.
 */
export async function calculateSha256(data: ArrayBuffer | Blob | Uint8Array): Promise<string> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : (data as ArrayBuffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Formats byte counts into human readable strings
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Helper to compress an image element via HTMLCanvasElement
 */
async function compressImageElement(
  img: HTMLImageElement,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  maxDimension = 2560,
  quality = 0.82
): Promise<Blob | null> {
  let { width, height } = img;

  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fill white background for JPEGs to prevent black alpha borders
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => {
        // Clean up canvas
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      mimeType,
      mimeType === 'image/png' ? undefined : quality
    );
  });
}

/**
 * Optimizes image files (JPEG, PNG, WebP)
 */
async function optimizeImage(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ optimizedBlob: Blob; method: string; applied: boolean }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isPng = ext === 'png';
  const isJpeg = ext === 'jpg' || ext === 'jpeg';
  const isWebp = ext === 'webp';

  onProgress?.('Decoding image scan...', 20);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = objectUrl;
    });

    onProgress?.('Applying resolution & compression optimization...', 50);

    let targetMime: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    let quality = 0.82;

    if (isPng) {
      // For PNG, try lossless PNG compression without converting blindly to JPEG
      targetMime = 'image/png';
    } else if (isWebp) {
      targetMime = 'image/webp';
    }

    const compressedBlob = await compressImageElement(img, targetMime, 2560, quality);

    if (compressedBlob && compressedBlob.size < file.size) {
      return {
        optimizedBlob: compressedBlob,
        method: isPng ? 'png-canvas-reencode' : 'jpeg-canvas-recompress',
        applied: true,
      };
    }

    return {
      optimizedBlob: file,
      method: isPng ? 'png-original-retained' : 'original-retained',
      applied: false,
    };
  } catch (err) {
    console.warn('Image optimization fallback to original:', err);
    return {
      optimizedBlob: file,
      method: 'original-retained',
      applied: false,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Optimizes Office Open XML documents (.docx, .pptx) by recompressing oversized embedded raster images
 */
async function optimizeOfficeDocument(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ optimizedBlob: Blob; method: string; applied: boolean }> {
  try {
    onProgress?.('Analyzing Office Open XML structure...', 25);
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Locate embedded raster images
    const mediaFiles: { path: string; file: JSZip.JSZipObject }[] = [];
    zip.forEach((relativePath, fileObj) => {
      if (
        !fileObj.dir &&
        relativePath.match(/^(word|ppt)\/media\/.*\.(jpe?g|png)$/i)
      ) {
        mediaFiles.push({ path: relativePath, file: fileObj });
      }
    });

    if (mediaFiles.length === 0) {
      onProgress?.('No embedded media requiring compression.', 80);
      return {
        optimizedBlob: file,
        method: 'office-original-retained',
        applied: false,
      };
    }

    onProgress?.(`Processing ${mediaFiles.length} embedded media assets...`, 40);
    let anyCompressed = false;

    for (let i = 0; i < mediaFiles.length; i++) {
      const { path, file: mediaEntry } = mediaFiles[i];
      const mediaBuffer = await mediaEntry.async('arraybuffer');

      // Only attempt compression on embedded images larger than 150 KB
      if (mediaBuffer.byteLength > 150 * 1024) {
        try {
          const mediaBlob = new Blob([mediaBuffer]);
          const mediaUrl = URL.createObjectURL(mediaBlob);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Media decode failed'));
            img.src = mediaUrl;
          });

          const isPng = path.toLowerCase().endsWith('.png');
          const compressed = await compressImageElement(
            img,
            isPng ? 'image/png' : 'image/jpeg',
            2048,
            0.80
          );
          URL.revokeObjectURL(mediaUrl);

          if (compressed && compressed.size < mediaBuffer.byteLength * 0.85) {
            const newBuffer = await compressed.arrayBuffer();
            zip.file(path, newBuffer);
            anyCompressed = true;
          }
        } catch {
          // If a specific media file fails, preserve original
        }
      }
    }

    if (!anyCompressed) {
      return {
        optimizedBlob: file,
        method: 'office-original-retained',
        applied: false,
      };
    }

    onProgress?.('Repackaging Office Open XML archive...', 80);
    const repackagedBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (repackagedBlob.size < file.size) {
      return {
        optimizedBlob: repackagedBlob,
        method: 'office-media-recompress',
        applied: true,
      };
    }

    return {
      optimizedBlob: file,
      method: 'office-original-retained',
      applied: false,
    };
  } catch (err) {
    console.warn('Office optimization error, retaining original:', err);
    return {
      optimizedBlob: file,
      method: 'office-original-retained',
      applied: false,
    };
  }
}

/**
 * Optimizes PDF using Ghostscript WebAssembly in an isolated worker runtime
 */
async function optimizePdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ optimizedBlob: Blob; method: string; applied: boolean }> {
  onProgress?.('Preparing Ghostscript WASM optimizer...', 15);

  const inputBuffer = await file.arrayBuffer();

  try {
    // Dynamic import to prevent loading 16MB WASM until a PDF is actually submitted
    const { load } = await import('@wasm-zoo/ghostscript');

    onProgress?.('Initializing isolated PDF WebAssembly runtime...', 30);
    const gs = await load({
      coreJsUrl: '/ghostscript/gs-core.js',
      wasmUrl: '/ghostscript/gs-core.wasm',
    });

    onProgress?.('Executing academic PDF stream compression & font subsetting...', 50);

    // Sensible academic profile: /ebook (150 dpi, compress text/streams, preserve selectable text)
    const result = await gs.exec(
      [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/ebook',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-sOutputFile=/out/optimized.pdf',
        '/input.pdf',
      ],
      {
        files: [{ name: '/input.pdf', data: inputBuffer }],
        dirs: ['/out'],
        outputs: ['/out/optimized.pdf'],
        timeoutMs: 90000,
      }
    );

    gs.dispose();

    if (result.files && result.files.length > 0 && result.files[0].data) {
      const outputBuffer = result.files[0].data;
      if (outputBuffer.byteLength > 0 && outputBuffer.byteLength < file.size) {
        const optimizedBlob = new Blob([outputBuffer], { type: 'application/pdf' });
        return {
          optimizedBlob,
          method: 'pdf-ghostscript',
          applied: true,
        };
      }
    }

    // If Ghostscript made the file larger (e.g. already compressed vector doc), retain original
    return {
      optimizedBlob: file,
      method: 'original-retained',
      applied: false,
    };
  } catch (err: any) {
    console.warn('Ghostscript WASM compression skipped or failed:', err);

    // If original file is within 10 MB stored limit, we retain the original
    if (file.size <= FILE_LIMITS.PDF_STORED_LIMIT) {
      return {
        optimizedBlob: file,
        method: 'pdf-fallback-original',
        applied: false,
      };
    }

    // If PDF exceeds 10 MB and compression failed, fail transparently
    throw new Error(
      `PDF optimization failed and original exceeds the 10 MB stored limit (${formatBytes(
        file.size
      )}). Please compress the document.`
    );
  }
}

/**
 * Universal client-side file optimizer service.
 * Enforces:
 * - Original SHA-256 calculation
 * - Format-specific optimization pipeline (PDF, Image, Office Open XML)
 * - Optimized SHA-256 calculation
 * - Strict size boundaries (retaining original if optimization made it larger)
 * - Memory cleanup
 */
export async function optimizeFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<OptimizationResult> {
  const originalSizeBytes = file.size;
  const fileName = file.name;
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();

  // 1. Initial size boundary checks
  if (originalSizeBytes > FILE_LIMITS.MAX_INPUT_BYTES) {
    throw new Error(
      `File size (${formatBytes(originalSizeBytes)}) exceeds the maximum input limit of 25 MB.`
    );
  }

  if (ext === '.pdf' && originalSizeBytes > FILE_LIMITS.PDF_ORIGINAL_LIMIT) {
    throw new Error(
      `PDF size (${formatBytes(originalSizeBytes)}) exceeds maximum input limit of 20 MB.`
    );
  }

  if (['.png', '.jpg', '.jpeg'].includes(ext) && originalSizeBytes > FILE_LIMITS.IMAGE_LIMIT) {
    throw new Error(
      `Image size (${formatBytes(originalSizeBytes)}) exceeds maximum limit of 10 MB.`
    );
  }

  if (['.docx', '.pptx', '.doc', '.ppt'].includes(ext) && originalSizeBytes > FILE_LIMITS.DOCX_LIMIT) {
    throw new Error(
      `Office document (${formatBytes(originalSizeBytes)}) exceeds maximum limit of 15 MB.`
    );
  }

  // 2. Original file hashing
  onProgress?.('Calculating original document fingerprint (SHA-256)...', 10);
  const originalHash = await calculateSha256(file);

  // 3. Format-specific optimization
  let optimizedBlob: Blob = file;
  let optimizationMethod = 'original-retained';
  let optimizationApplied = false;

  if (ext === '.pdf') {
    const res = await optimizePdf(file, onProgress);
    optimizedBlob = res.optimizedBlob;
    optimizationMethod = res.method;
    optimizationApplied = res.applied;
  } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    const res = await optimizeImage(file, onProgress);
    optimizedBlob = res.optimizedBlob;
    optimizationMethod = res.method;
    optimizationApplied = res.applied;
  } else if (['.docx', '.pptx'].includes(ext)) {
    const res = await optimizeOfficeDocument(file, onProgress);
    optimizedBlob = res.optimizedBlob;
    optimizationMethod = res.method;
    optimizationApplied = res.applied;
  } else if (['.doc', '.ppt'].includes(ext)) {
    // Legacy binary format: skip risky rewriting as specified in Requirement 7
    onProgress?.('Legacy Office binary format: optimization skipped — original retained.', 90);
    optimizedBlob = file;
    optimizationMethod = 'legacy-binary-skipped';
    optimizationApplied = false;
  }

  // 4. Stored result validation
  const optimizedSizeBytes = optimizedBlob.size;

  if (ext === '.pdf' && optimizedSizeBytes > FILE_LIMITS.PDF_STORED_LIMIT) {
    throw new Error(
      `Optimized PDF size (${formatBytes(
        optimizedSizeBytes
      )}) exceeds the maximum archival limit of 10 MB.`
    );
  }

  // 5. Optimized file hashing
  onProgress?.('Generating canonical archive hash (SHA-256)...', 95);
  const optimizedHash =
    optimizationApplied && optimizedBlob !== file
      ? await calculateSha256(optimizedBlob)
      : originalHash;

  const savingsBytes = Math.max(0, originalSizeBytes - optimizedSizeBytes);
  const savingsPercentage =
    originalSizeBytes > 0 ? Math.round((savingsBytes / originalSizeBytes) * 100) : 0;
  const compressionRatio =
    originalSizeBytes > 0 ? Number((optimizedSizeBytes / originalSizeBytes).toFixed(3)) : 1.0;

  onProgress?.('Optimization completed successfully.', 100);

  return {
    originalFile: file,
    optimizedFile: optimizedBlob,
    originalSizeBytes,
    optimizedSizeBytes,
    originalHash,
    optimizedHash,
    optimizationApplied,
    optimizationMethod,
    compressionRatio,
    savingsBytes,
    savingsPercentage,
  };
}

export const FileOptimizer = {
  optimizeFile,
  calculateSha256,
  formatBytes,
  FILE_LIMITS,
};
