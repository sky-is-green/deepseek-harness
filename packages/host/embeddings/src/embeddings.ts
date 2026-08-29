/**
 * Embedding generation — pure helpers for /v1/embeddings.
 * Deterministic mock vectors, no model dependency.
 * @module @deepseek-ai/dsh-host-embeddings/embeddings
 */

/** One embedding data entry (OpenAI shape). */
export interface EmbeddingData {
  object: 'embedding'
  embedding: number[]
  index: number
}

/** Successful embeddings response. */
export interface EmbeddingsResponse {
  object: 'list'
  data: EmbeddingData[]
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}

/**
 * Deterministic vector from text — 8 dims, values in [-1, 1].
 * Hash-based, no crypto.
 * @param text - input text.
 * @returns 8-dim vector.
 */
export function embedOne(text: string): number[] {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out: number[] = []
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ (i * 2654435761), 16777619)
    const v = (h >>> 0) / 0xffffffff
    out.push(v * 2 - 1)
  }
  return out
}

/**
 * Handle an embeddings request body.
 * @param body - parsed JSON.
 * @returns response or error.
 */
export function handleEmbeddingsRequest(body: unknown):
  | { ok: true; response: EmbeddingsResponse }
  | { ok: false; status: number; error: string } {
  const b = body as Record<string, unknown>
  const model = typeof b.model === 'string' ? b.model : ''
  if (!model) return { ok: false, status: 400, error: 'missing model' }

  const rawInput = b.input
  let inputs: string[] = []
  if (typeof rawInput === 'string') inputs = [rawInput]
  else if (Array.isArray(rawInput) && rawInput.every((v): v is string => typeof v === 'string')) inputs = rawInput
  else return { ok: false, status: 400, error: 'input must be string or string[]' }

  if (inputs.length === 0) return { ok: false, status: 400, error: 'input empty' }

  const data: EmbeddingData[] = inputs.map((text, index) => ({
    object: 'embedding',
    embedding: embedOne(text),
    index,
  }))

  const promptTokens = inputs.reduce((n, t) => n + Math.ceil(t.length / 4), 0)

  return {
    ok: true,
    response: {
      object: 'list',
      data,
      model,
      usage: { prompt_tokens: promptTokens, total_tokens: promptTokens },
    },
  }
}
