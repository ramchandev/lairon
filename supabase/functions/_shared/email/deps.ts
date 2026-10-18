import { resendMailer } from './resend.ts'
import { dbStore } from './store.ts'
import type { Deps } from './send.ts'

/** Production wiring: log in Postgres, send with Resend. */
export const deps: Deps = { store: dbStore, mailer: resendMailer }
