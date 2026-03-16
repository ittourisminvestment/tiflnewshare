import { SupabaseClient } from '@supabase/supabase-js';

export async function getAvailableCheques(supabase: SupabaseClient, bankId: string) {
  if (!bankId) return [];

  const [rangesRes, expRes, divRes, coInvRes, loanRes] = await Promise.all([
    supabase.from('cheque_books').select('start_no, end_no').eq('company_bank_id', bankId).eq('is_active', true),
    supabase.from('expenses').select('cheque_number').eq('company_bank_id', bankId).is('deleted_at', null).not('cheque_number', 'is', null),
    supabase.from('dividends').select('cheque_number').eq('company_bank_id', bankId).is('deleted_at', null).not('cheque_number', 'is', null),
    supabase.from('company_investments').select('cheque_number').eq('company_bank_id', bankId).is('deleted_at', null).not('cheque_number', 'is', null),
    supabase.from('loans').select('cheque_number').eq('company_bank_id', bankId).is('deleted_at', null).not('cheque_number', 'is', null),
  ]);

  const used = new Set([
    ...(expRes.data || []).map(r => r.cheque_number),
    ...(divRes.data || []).map(r => r.cheque_number),
    ...(coInvRes.data || []).map(r => r.cheque_number),
    ...(loanRes.data || []).map(r => r.cheque_number),
  ].filter(Boolean));

  const available: string[] = [];
  (rangesRes.data || []).forEach(range => {
    for (let i = range.start_no; i <= range.end_no; i++) {
      const s = String(i);
      if (!used.has(s)) {
        available.push(s);
      }
    }
  });

  return available.sort((a, b) => parseInt(a) - parseInt(b));
}
