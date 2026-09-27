export interface SourceMap {
  version?: number
  file?: string
  sourceRoot?: string | null
  sources?: string[]
  sourcesContent?: Array<string | null>
  names?: string[]
  mappings?: string
  [key: string]: unknown
}

export interface SourceMapData {
  map: SourceMap
  url: string | null
  sourcesRelativeTo: string
  sourceMappingURL: string | null
}

export interface ResolveSourcesResult {
  sourcesResolved: string[]
  sourcesContent: Array<string | Error>
}

export interface ResolvedSourceMap extends SourceMapData, ResolveSourcesResult {}

export interface ResolveOptions {
  sourceRoot?: string | false
}

export type ReadCallback = (error: Error | null, contents?: unknown) => void
export type Read = (url: string, callback: ReadCallback) => void
export type ReadSync = (url: string) => unknown
export type ResultCallback<T> = (error: Error | null, result?: T | null) => void

export function resolveSourceMap(
  code: string,
  codeUrl: string,
  read: Read,
  callback: ResultCallback<SourceMapData>
): void

export function resolveSourceMapSync(
  code: string,
  codeUrl: string,
  read?: ReadSync
): SourceMapData | null

export function resolveSources(
  map: SourceMap,
  mapUrl: string,
  read: Read,
  callback: ResultCallback<ResolveSourcesResult>
): void

export function resolveSources(
  map: SourceMap,
  mapUrl: string,
  read: Read,
  options: ResolveOptions,
  callback: ResultCallback<ResolveSourcesResult>
): void

export function resolveSourcesSync(
  map: SourceMap,
  mapUrl: string,
  read: ReadSync | null,
  options?: ResolveOptions
): ResolveSourcesResult

export function resolve(
  code: string | null,
  codeUrl: string,
  read: Read,
  callback: ResultCallback<ResolvedSourceMap>
): void

export function resolve(
  code: string | null,
  codeUrl: string,
  read: Read,
  options: ResolveOptions,
  callback: ResultCallback<ResolvedSourceMap>
): void

export function resolveSync(
  code: string | null,
  codeUrl: string,
  read: ReadSync,
  options?: ResolveOptions
): ResolvedSourceMap | null

export function parseMapToJSON(string: string, data?: unknown): SourceMap

