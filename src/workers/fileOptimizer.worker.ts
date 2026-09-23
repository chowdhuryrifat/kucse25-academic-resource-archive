// Web Worker for asynchronous file optimization tasks & off-thread hashing.
// Offloads SHA-256 fingerprinting and image re-compression (OffscreenCanvas)
// so the React UI thread stays responsive during intensive operations.
// Runs in a real Worker scope: `self` is typed as Worker for message APIs.

export interface WorkerOptimizationRequest {
  id: string;
  type: 'hash' | 'compress-buffer';
  buffer?: ArrayBuffer;
  options?: Record<string, any>;
}

export interface WorkerOptimizationResponse {
  id: string;
  success: boolean;
  hash?: string;
  buffer?: ArrayBuffer;
  size?: number;
  error?: string;
}

const workerScope: Worker = self as unknown as Worker;

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Re-compresses a raster image buffer (JPEG/PNG/WebP) using OffscreenCanvas.
 * Keeps the original format; scales down oversized dimensions and re-encodes.
 */
async function compressRasterBuffer(
  buffer: ArrayBuffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  maxDimension: number,
  quality: number
): Promise<{ buffer: ArrayBuffer; size: number }> {
  const sourceBlob = new Blob([buffer], { type: mimeType });
  const bitmap = await createImageBitmap(sourceBlob);

  try {
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2D context unavailable');
    }

    // Fill white background for JPEG to prevent black alpha borders
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    const outBlob = await canvas.convertToBlob({
      type: mimeType,
      quality: mimeType === 'image/png' ? undefined : quality,
    });

    const outBuffer = await outBlob.arrayBuffer();
    return { buffer: outBuffer, size: outBuffer.byteLength };
  } finally {
    bitmap.close();
  }
}

workerScope.onmessage = async (event: MessageEvent<WorkerOptimizationRequest>) => {
  const { id, type, buffer, options } = event.data;

  try {
    if (type === 'hash') {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('Hash requires an ArrayBuffer payload.');
      }
      const hash = await sha256Hex(buffer);
      const response: WorkerOptimizationResponse = { id, success: true, hash };
      workerScope.postMessage(response);
      return;
    }

    if (type === 'compress-buffer') {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('compress-buffer requires an ArrayBuffer payload.');
      }
      const opts = options || {};
      const mimeType: 'image/jpeg' | 'image/png' | 'image/webp' =
        opts.mimeType === 'image/png'
          ? 'image/png'
          : opts.mimeType === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';
      const maxDimension = typeof opts.maxDimension === 'number' ? opts.maxDimension : 2560;
      const quality = typeof opts.quality === 'number' ? opts.quality : 0.82;

      const result = await compressRasterBuffer(buffer, mimeType, maxDimension, quality);
      const response: WorkerOptimizationResponse = {
        id,
        success: true,
        buffer: result.buffer,
        size: result.size,
      };
      workerScope.postMessage(response, [result.buffer]);
      return;
    }

    workerScope.postMessage({
      id,
      success: false,
      error: `Unknown worker action: ${type}`,
    } as WorkerOptimizationResponse);
  } catch (err: any) {
    workerScope.postMessage({
      id,
      success: false,
      error: err?.message || 'Worker processing error',
    } as WorkerOptimizationResponse);
  }
};