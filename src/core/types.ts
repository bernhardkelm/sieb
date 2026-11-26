export type SourceKind = 'mock' | 'kubectl' | 'incluster'

export interface HealthResponse {
  status: 'ok'
  source: SourceKind
}
