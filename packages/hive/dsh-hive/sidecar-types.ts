/* AUTO-GENERATED from the sidecar's /openapi.json — do not edit by hand.
 * Regenerate: node scripts/generate-sidecar-types.js <openapi.json> <this file>
 * Drift check: node scripts/drift-check.js (fails CI on wire-contract change)
 */

export const SIDECAR_TITLE = 'HiveBench Studio harness'
export const SIDECAR_VERSION = '0.1.0'

// ------------------------------------------------------------------
// Schemas
// ------------------------------------------------------------------
export type AgentMessageRequest = {
  message: string
  conversation_id?: string
}

export type CommandRunRequest = {
  line: string
  conversation_id?: string
}

export type CurateRequest = {
  query: string
  conversation_id?: string
  engine?: string | unknown
  config?: Record<string, unknown> | unknown
}

export type EngineConfigRequest = {
  engines: Array<EngineEntry>
  default?: string
  persist?: boolean
}

export type EngineEntry = {
  name: string
  kind?: string
  base_url?: string
  load_options?: Record<string, unknown>
  capabilities?: Array<string>
  sampling?: Record<string, unknown>
}

export type HTTPValidationError = {
  detail?: Array<ValidationError>
}

export type HubDownloadRequest = {
  repo: string
  file: string
}

export type ObserveRequest = {
  conversation_id: string
  reply: string
}

export type ProtocolRunRequest = {
  mode?: string
  args?: Record<string, unknown>
}

export type ProviderConfigRequest = {
  providers: Array<ProviderEntry>
  default?: string
  persist?: boolean
}

export type ProviderEntry = {
  name: string
  base_url: string
  api_key?: string
  model?: string
  headers?: Record<string, unknown>
}

export type ResetRequest = {
  conversation_id: string
}

export type ServerStartRequest = {
  model?: string | unknown
  hf_repo?: string | unknown
  hf_file?: string | unknown
  key?: string | unknown
  port?: number | unknown
  ctx_size?: number
  ngl?: number
  register_provider?: boolean
  claim_default?: boolean
  threads?: number | unknown
  flash_attn?: boolean
  parallel_slots?: number | unknown
  cache_type_k?: string | unknown
  cache_type_v?: string | unknown
  batch_size?: number | unknown
  ubatch_size?: number | unknown
  alias?: string | unknown
  mlock?: boolean
  no_mmap?: boolean
  api_key?: string | unknown
}

export type ServerUnloadRequest = {
  key: string
}

export type StreamTurnRequest = {
  query: string
  conversation_id?: string
  engine?: string | unknown
  config?: Record<string, unknown> | unknown
}

export type TurnRequest = {
  query: string
  conversation_id?: string
  model?: string | unknown
  provider?: string | unknown
  engine?: string | unknown
  config?: Record<string, unknown> | unknown
}

export type ValidationError = {
  loc: Array<string | number>
  msg: string
  type: string
  input?: unknown
  ctx?: Record<string, unknown>
}

// ------------------------------------------------------------------
// Endpoints
// ------------------------------------------------------------------
export type healthhealthgetResponse = Record<string, unknown>

export type hiveturnv1hiveturnpostRequest = TurnRequest

export type hiveturnv1hiveturnpostResponse = Record<string, unknown>

export type hiveinspectv1hiveinspectconversationidgetResponse = Record<string, unknown>

export type hiveresetv1hiveresetpostRequest = ResetRequest

export type hiveresetv1hiveresetpostResponse = Record<string, unknown>

export type hivecuratev1hivecuratepostRequest = CurateRequest

export type hivecuratev1hivecuratepostResponse = Record<string, unknown>

export type hiveobservev1hiveobservepostRequest = ObserveRequest

export type hiveobservev1hiveobservepostResponse = Record<string, unknown>

export type hivestreamv1hivestreampostRequest = StreamTurnRequest

export type hivestreamv1hivestreampostResponse = Record<string, unknown>

export type hivedefaultsv1hivedefaultsgetResponse = Record<string, unknown>

export type hivestatev1hivestategetResponse = Record<string, unknown>

export type modelsv1modelsgetResponse = Record<string, unknown>

export type mockchatcompletionsv1chatcompletionspostResponse = Record<string, unknown>

export type openaichatcompletionsv1openaichatcompletionspostResponse = Record<string, unknown>

export type getprovidersv1providerconfiggetResponse = Record<string, unknown>

export type setprovidersv1providerconfigpostRequest = ProviderConfigRequest

export type setprovidersv1providerconfigpostResponse = Record<string, unknown>

export type getenginesv1enginesgetResponse = Record<string, unknown>

export type setenginesv1enginespostRequest = EngineConfigRequest

export type setenginesv1enginespostResponse = Record<string, unknown>

export type listcommandsv1commandsgetResponse = Record<string, unknown>

export type runcommandv1commandsrunpostRequest = CommandRunRequest

export type runcommandv1commandsrunpostResponse = Record<string, unknown>

export type agentstreamv1agentstreampostRequest = AgentMessageRequest

export type agentstreamv1agentstreampostResponse = Record<string, unknown>

export type agentstatusv1agentstatusgetResponse = Record<string, unknown>

export type agentcancelv1agentcancelpostResponse = Record<string, unknown>

export type serverstatusv1serverstatusgetResponse = Record<string, unknown>

export type serverlogv1serverloggetResponse = Record<string, unknown>

export type servermemoryv1servermemorygetResponse = Record<string, unknown>

export type servermetricsv1servermetricsgetResponse = Record<string, unknown>

export type deletelocalmodelv1modelslocaldeleteResponse = Record<string, unknown>

export type localmodelsv1modelslocalgetResponse = Record<string, unknown>

export type serverstopv1serverstoppostResponse = Record<string, unknown>

export type serverstartv1serverstartpostRequest = ServerStartRequest

export type serverstartv1serverstartpostResponse = Record<string, unknown>

export type serverunloadv1serverunloadpostRequest = ServerUnloadRequest

export type serverunloadv1serverunloadpostResponse = Record<string, unknown>

export type hubsearchv1modelshubgetResponse = Record<string, unknown>

export type hubfilesv1modelshubfilesrepogetResponse = Record<string, unknown>

export type hubdownloadv1modelshubdownloadpostRequest = HubDownloadRequest

export type hubdownloadv1modelshubdownloadpostResponse = Record<string, unknown>

export type hubdownloadsv1modelshubdownloadsgetResponse = Record<string, unknown>

export type protocolrunv1protocolrunpostRequest = ProtocolRunRequest

export type protocolrunv1protocolrunpostResponse = Record<string, unknown>

export type reportv1reportrundirgetResponse = Record<string, unknown>

export type runsindexv1runsgetResponse = Record<string, unknown>
