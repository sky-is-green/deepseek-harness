/**
 * Vocabulary for the GGUF header reader. Types only — runtime code lives in
 * `parser.ts`, `reader.ts`, and `index.ts`.
 * @module
 */

/**
 * Metadata surfaced from one GGUF header. Fields are absent when the weight
 * file does not carry them; the file still parses.
 */
export interface GgufMetadata {
  /** GGUF container version the header declares (only 2 and 3 parse). */
  readonly formatVersion: number
  /** Model family from `general.architecture` (e.g. `qwen3`). */
  readonly architecture?: string
  /** Human-facing model name from `general.name`, when present. */
  readonly name?: string
  /**
   * Quantization label derived from `general.file_type` (e.g. `Q4_K_M`);
   * unknown enum values render as `ftype-N`.
   */
  readonly quantization?: string
  /** Trained context length from `<architecture>.context_length`. */
  readonly contextLength?: number
  /** Jinja chat template from `tokenizer.chat_template`, when embedded. */
  readonly chatTemplate?: string
}
