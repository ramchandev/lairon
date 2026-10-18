import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailStatus } from './labels'

export interface EmailLogRow {
  id: string
  to: string
  template: string
  subject: string | null
  status: EmailStatus
  error: string | null
  attempts: number
  created_at: string
  sent_at: string | null
}
const KEY = ['email-log']

export const useEmailLog = () =>
  useQuery({
    queryKey: KEY,
    refetchInterval: 20_000, // new emails appear without a manual refresh
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_log')
        .select('id, to, template, subject, status, error, attempts, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return data as EmailLogRow[]
    },
  })

export function useRetryEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (logId: string) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { log_id: logId },
      })
      if (error) {
        let msg = 'Could not retry. Please try again.'
        if (error instanceof FunctionsHttpError)
          msg = (await error.context.json().catch(() => ({})))?.error ?? msg
        throw new Error(msg)
      }
      return data as { status: 'sent' | 'failed' | 'skipped'; error?: string }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Admins who get request emails (Settings). Empty means "every active admin". */
export const useNotifyEmails = () =>
  useQuery({
    queryKey: ['app-settings', 'notify_emails'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'notify_emails')
        .maybeSingle()
      if (error) throw error
      return Array.isArray(data?.value) ? (data!.value as string[]) : []
    },
  })

export function useSaveNotifyEmails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (emails: string[]) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'notify_emails', value: emails, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings', 'notify_emails'] }),
  })
}
