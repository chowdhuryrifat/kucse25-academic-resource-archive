// Web Worker for asynchronous file optimization tasks & off-thread hashing
// Web Workers help keep the React UI smooth during intensive file hashing and operations

export interface WorkerOptimizationRequest {
  id: string;
  type: 'hash' | 'compress-buffer';
  buffer: ArrayBuffer;
  options?: Record<string, any>;
}

export interface WorkerOptimizationResponse {
  id: string;
  success: boolean;
  hash?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

self.onmessage = async (event: MessageEvent<WorkerOptimizationRequest>) => {
  const { id, type, buffer } = event.data;

  try {
    if (type === 'hash') {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const response: WorkerOptimizationResponse = {
        id,
        success: true,
        hash: hashHex,
      };
      self.postMessage(response);
    } else {
      self.postMessage({ id, success: false, error: 'Unknown worker action' });
    }
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err?.message || 'Worker processing error',
    });
  }
};
