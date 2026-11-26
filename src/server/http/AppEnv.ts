/** Hono environment of the sieb app: the acting user the identity middleware resolved */
export interface AppEnv {
  Variables: {
    actor: string | null // null for anonymous reads, write routes never see null
  }
}
