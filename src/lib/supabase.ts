import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// 缺配置不抛异常，让登录页给出明确提示，而不是整页白屏。
export const configError = !url || !publishableKey
  ? '缺少 Supabase 环境变量（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）。'
  : null

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  publishableKey ?? 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
