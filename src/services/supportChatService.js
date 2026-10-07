import { supabase } from '../lib/supabase'

export async function sendSupportMessage(message, conversationHistory = []) {
  const { data, error } = await supabase.functions.invoke('support-chat', {
    body: { message, conversationHistory },
  })

  if (error) {
    if (error.context instanceof Response) {
      if (error.context.status === 400) {
        throw new Error('Please send a valid message and try again.')
      }
      if (error.context.status === 401) {
        throw new Error('Please sign in again to use Giftly Support.')
      }
      if (error.context.status === 503) {
        throw new Error('Giftly AI Support is not configured yet. Please contact Giftly Support.')
      }
      if (error.context.status === 504) {
        throw new Error('Giftly Support timed out. Please try again.')
      }
    }
    throw new Error('Giftly Support is temporarily unavailable. Please try again shortly.')
  }

  if (typeof data?.reply !== 'string' || !data.reply.trim()) {
    throw new Error('Giftly Support returned an invalid response. Please try again.')
  }

  return data.reply
}
