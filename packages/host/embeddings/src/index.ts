/**
 * Embedding model hosting + /v1/embeddings.
 * @module @deepseek-ai/dsh-host-embeddings
 */
export { embedOne, handleEmbeddingsRequest } from './embeddings.ts'
export type { EmbeddingsResponse, EmbeddingData } from './embeddings.ts'
export { name, inject, apply } from './service.ts'
