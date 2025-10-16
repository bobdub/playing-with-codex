declare module 'fs' {
  export interface FileStats {
    isFile(): boolean;
    isDirectory(): boolean;
  }

  export function readFileSync(path: string, options?: { encoding?: string } | string): string;
  export function writeFileSync(path: string, data: string, options?: { encoding?: string } | string): void;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): FileStats;
}

declare module 'path' {
  export function resolve(...pathSegments: string[]): string;
  export function join(...pathSegments: string[]): string;
  export function basename(path: string): string;
}

declare const process: {
  argv: string[];
  exit(code?: number): never;
  stdout: { write(chunk: string): void };
};
