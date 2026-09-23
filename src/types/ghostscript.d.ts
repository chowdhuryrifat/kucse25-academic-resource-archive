declare module '@wasm-zoo/ghostscript' {
  export interface GhostscriptFile {
    name: string;
    data: ArrayBuffer | Uint8Array;
  }

  export interface GhostscriptExecOptions {
    files?: GhostscriptFile[];
    dirs?: string[];
    outputs?: string[];
    timeoutMs?: number;
  }

  export interface GhostscriptExecResult {
    exitCode: number;
    files: {
      name: string;
      data: ArrayBuffer;
    }[];
    stdout?: string;
    stderr?: string;
  }

  export interface GhostscriptInstance {
    exec(args: string[], options?: GhostscriptExecOptions): Promise<GhostscriptExecResult>;
    dispose(): void;
  }

  export interface GhostscriptLoadOptions {
    coreJsUrl?: string;
    wasmUrl?: string;
  }

  export function load(options?: GhostscriptLoadOptions): Promise<GhostscriptInstance>;
}
