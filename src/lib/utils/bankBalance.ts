import { SupabaseClient } from '@supabase/supabase-js';

export async function getBankBalance(supabase: SupabaseClient, bankId: string) {
  if (!bankId) return 0;

  // 1. Fetch initial balance
  const { data: bank } = await supabase
    .from('company_banks')
    .select('initial_balance')
    .eq('id', bankId)
    .single();

  const initial = Number(bank?.initial_balance || 0);

  // 2. Fetch all movements
  const [invRes, roiRes, expRes, coInvRes, loanRes, repayRes, divRes, pettyRes] = await Promise.all([
    supabase.from('investments').select('amount').eq('company_bank_id', bankId).eq('status', 'verified').is('deleted_at', null),
    supabase.from('investment_returns').select('net_amount').eq('company_bank_id', bankId).is('deleted_at', null),
    supabase.from('expenses').select('amount').eq('company_bank_id', bankId).is('deleted_at', null),
    supabase.from('company_investments').select('principal_amount').eq('company_bank_id', bankId).is('deleted_at', null),
    supabase.from('loans').select('principal').eq('company_bank_id', bankId).is('deleted_at', null),
    supabase.from('loan_repayments').select('amount').eq('company_bank_id', bankId),
    supabase.from('dividends').select('amount').eq('company_bank_id', bankId).is('deleted_at', null),
    supabase.from('petty_cash_ledger').select('amount').eq('bank_id', bankId).eq('type', 'inflow').eq('source', 'bank_transfer')
  ]);

  const totalIn = 
    (invRes.data || []).reduce((s, r) => s + Number(r.amount), 0) + 
    (roiRes.data || []).reduce((s, r) => s + Number(r.net_amount), 0) +
    (repayRes.data || []).reduce((s, r) => s + Number(r.amount), 0);

  const totalOut = 
    (expRes.data || []).reduce((s, r) => s + Number(r.amount), 0) + 
    (coInvRes.data || []).reduce((s, r) => s + Number(r.principal_amount), 0) +
    (loanRes.data || []).reduce((s, r) => s + Number(r.principal), 0) +
    (divRes.data || []).reduce((s, r) => s + Number(r.amount), 0) +
    (pettyRes.data || []).reduce((s, r) => s + Number(r.amount), 0);

  return initial + totalIn - totalOut;
}

export async function getPettyCashBalance(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('petty_cash_ledger')
    .select('amount, type');

  return (data || []).reduce((acc, entry) => {
    return entry.type === 'inflow' ? acc + Number(entry.amount) : acc - Number(entry.amount);
  }, 0);
}
