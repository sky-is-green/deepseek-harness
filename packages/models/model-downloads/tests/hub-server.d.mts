import type { Server } from 'node:http'

/** Mutable request state shared between the fixture and assertions. */
export interface HubState {
  /** Range header of the most recent GET, or null. */
  lastRange: string | null
  /** When true, GETs ignore range requests and answer 200 with the full body. */
  ignoreRange: boolean
  /** When true, ranged GETs answer 416. */
  respond416: boolean
}

/** Construction options for {@link createHubServer}. */
export interface HubOptions {
  /** Overrides the advertised etag for every file. */
  etag?: string
  /** Omits the accept-ranges header when false is not set (defaults to advertising). */
  advertiseRanges?: boolean
  /** Per-file payload overrides keyed by file name. */
  payloads?: Record<string, Buffer>
}

/**
 * Create the hub server (not yet listening).
 * @param payload - the default bytes every file resolves to.
 * @param options - etag override, range advertisement, and per-file payloads.
 * @returns the server plus mutable request state for assertions.
 */
export function createHubServer(
  payload: Buffer,
  options?: HubOptions,
): { server: Server; state: HubState }
