'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { Plus, X, Wallet, Calendar, Search, Eye, Trash2, CheckCircle, Smartphone as SmartphoneIcon, Printer, Landmark } from 'lucide-react';
import { getAvailableCheques } from '@/lib/utils/chequeUtils';
import { adToBs } from '@/lib/utils/nepaliDate';
import NepaliDateInput from '../components/NepaliDateInput';
import { getBankBalance, getPettyCashBalance } from '@/lib/utils/bankBalance';
import { processImage } from '@/lib/utils/imageProcess';

interface Loan {
  id: string;
  shareholder_id: string;
  principal: number;
  interest_rate: number;
  issue_date: string;
  due_date: string | null;
  amount_repaid: number;
  status: string;
  remarks: string | null;
  shareholders: { first_name: string; last_name: string; phone_number: string | null };
  tenure_months: number;
  repayment_frequency: string;
  reference_1_id: string | null;
  reference_2_id: string | null;
  payment_method: string | null;
  company_bank_id: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  receipt_url: string | null;
  cheque_number: string | null;
  cheque_image_url: string | null;
  company_bank_id: string | null;
  remarks: string | null;
  created_at: string;
}

interface Installment {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  status: string;
}

interface ShareholderOption { 
  id: string; 
  first_name: string; 
  last_name: string; 
  total_investment: number;
}

interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
}

export default function LoansPage() {
  const supabase = createClient();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [banks, setBanks] = useState<CompanyBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loanMaxPercentage, setLoanMaxPercentage] = useState(50);
  const [loanChequeFile, setLoanChequeFile] = useState<File | null>(null);
  const [loanChequePreview, setLoanChequePreview] = useState<string | null>(null);
  const [availableCheques, setAvailableCheques] = useState<string[]>([]);
  const [loadingCheques, setLoadingCheques] = useState(false);
  const [currentSelectedBalance, setCurrentSelectedBalance] = useState<number | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const isImageUrl = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || url.startsWith('blob:');
  };
  
  const [form, setForm] = useState({ 
    shareholder_id: '', 
    reference_1: '', 
    reference_2: '', 
    srv_charge_method: 'deduct' as 'deduct' | 'separate',
    principal: '', 
    interest_rate: '0', 
    issue_date: new Date().toISOString().split('T')[0], 
    due_date: '', 
    remarks: '',
    tenure_months: '12',
    repayment_frequency: 'monthly',
    company_bank_id: '',
    payment_method: 'bank',
    cheque_number: '',
  });

  // Repayment Modal State
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [repayForm, setRepayForm] = useState({
    amount: '',
    payment_method: 'bank',
    payment_date: new Date().toISOString().split('T')[0],
    remarks: '',
    cheque_number: '',
    company_bank_id: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequePreview, setChequePreview] = useState<string | null>(null);
  const [modalOutstanding, setModalOutstanding] = useState(0);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [allInstallments, setAllInstallments] = useState<Installment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'schedule' | 'repayments'>('schedule');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [loanRes, shRes, settingsRes, bankRes, instRes] = await Promise.all([
      supabase.from('loans').select('*, shareholders!loans_shareholder_id_fkey(first_name, last_name, phone_number)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('shareholders').select('id, first_name, last_name, investments(amount, status)').is('deleted_at', null).eq('is_active', true),
      supabase.from('company_settings').select('loan_max_percentage, default_interest_rate, service_charge, grace_period, penalty_percent').limit(1).single(),
      supabase.from('company_banks').select('id, bank_name, account_number').eq('is_active', true),
      supabase.from('loan_installments').select('*')
    ]);
    
    setAllInstallments((instRes.data || []) as Installment[]);

    const parsedShareholders = (shRes.data || []).map((sh: any) => {
      const totalInv = (sh.investments || [])
        .filter((inv: any) => inv.status === 'verified')
        .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
      return { id: sh.id, first_name: sh.first_name, last_name: sh.last_name, total_investment: totalInv };
    });

    if (loanRes.error) console.error('Failed to fetch loans:', loanRes.error);
    setLoans((loanRes.data || []) as Loan[]);
    setShareholders(parsedShareholders);
    setBanks((bankRes.data || []) as CompanyBank[]);
    if (settingsRes.data) {
      setCompanySettings(settingsRes.data);
      if (settingsRes.data.loan_max_percentage) {
        setLoanMaxPercentage(settingsRes.data.loan_max_percentage);
      }
      if (settingsRes.data.default_interest_rate !== undefined) {
        setForm(p => ({ ...p, interest_rate: settingsRes.data.default_interest_rate.toString() }));
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (form.issue_date && form.tenure_months) {
      const startDate = new Date(form.issue_date);
      const months = parseInt(form.tenure_months) || 0;
      if (months > 0) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + months);
        setForm(p => ({ ...p, due_date: dueDate.toISOString().split('T')[0] }));
      }
    }
  }, [form.issue_date, form.tenure_months, showModal]);

  useEffect(() => {
    if (loans.length > 0 && !startDate && !endDate) {
      setStartDate(loans[0].issue_date); // Most recent transaction date
      setEndDate(new Date().toISOString().split('T')[0]); // Today
    }
  }, [loans, startDate, endDate]);

  useEffect(() => {
    const loadCheques = async () => {
      if (form.company_bank_id) {
        setLoadingCheques(true);
        const cheques = await getAvailableCheques(supabase, form.company_bank_id);
        setAvailableCheques(cheques);
        setLoadingCheques(false);
      } else {
        setAvailableCheques([]);
      }
    };
    loadCheques();
  }, [form.company_bank_id, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (form.payment_method === 'petty_cash') {
        setFetchingBalance(true);
        const bal = await getPettyCashBalance(supabase);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else if (form.company_bank_id) {
        setFetchingBalance(true);
        const bal = await getBankBalance(supabase, form.company_bank_id);
        setCurrentSelectedBalance(bal);
        setFetchingBalance(false);
      } else {
        setCurrentSelectedBalance(null);
      }
    };
    fetchBalance();
  }, [form.company_bank_id, form.payment_method, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let balanceToCheck = currentSelectedBalance;
    if (balanceToCheck === null || fetchingBalance) {
      if (form.payment_method === 'petty_cash') {
        balanceToCheck = await getPettyCashBalance(supabase);
      } else if (form.company_bank_id) {
        balanceToCheck = await getBankBalance(supabase, form.company_bank_id);
      }
    }

    if (balanceToCheck !== null && parseFloat(form.principal) > balanceToCheck) {
      toast.error(`Insufficient balance. Current balance is Rs. ${balanceToCheck.toLocaleString()}`);
      return;
    }

    setSaving(true);
    // Check max limit
    if (form.shareholder_id && form.reference_1 && form.reference_2) {
      const borrowerInv = shareholders.find(s => s.id === form.shareholder_id)?.total_investment || 0;
      const ref1Inv = shareholders.find(s => s.id === form.reference_1)?.total_investment || 0;
      const ref2Inv = shareholders.find(s => s.id === form.reference_2)?.total_investment || 0;
      const maxLimit = (borrowerInv + ref1Inv + ref2Inv) * (loanMaxPercentage / 100);

      if (parseFloat(form.principal) > maxLimit) {
        toast.error(`Amount exceeds maximum allowed limit of Rs. ${maxLimit.toLocaleString()}`);
        setSaving(false);
        return;
      }
    }

    // Check if borrower already has an active loan or is a reference for one
    const isLocked = loans.some(l => 
      l.status === 'active' && 
      (l.shareholder_id === form.shareholder_id || l.reference_1_id === form.shareholder_id || l.reference_2_id === form.shareholder_id)
    );
    if (isLocked) {
      toast.error("This shareholder is already involved in an active loan (as borrower or reference).");
      setSaving(false);
      return;
    }

    // Check if References are locked
    const ref1Locked = loans.some(l => l.status === 'active' && (l.shareholder_id === form.reference_1 || l.reference_1_id === form.reference_1 || l.reference_2_id === form.reference_1));
    const ref2Locked = loans.some(l => l.status === 'active' && (l.shareholder_id === form.reference_2 || l.reference_1_id === form.reference_2 || l.reference_2_id === form.reference_2));

    if (ref1Locked || ref2Locked) {
      toast.error("One or more references are already involved in an active loan.");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    let chequeUrl = null;
    if (loanChequeFile) {
      const processedFile = await processImage(loanChequeFile);
      const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
        ? new File([processedFile], loanChequeFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
        : processedFile as File;

      const ext = finalFile.name.split('.').pop();
      const filePath = `loan-issue/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(filePath, finalFile);
      if (error) { toast.error('Failed to upload cheque receipt'); setSaving(false); return; }
      const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
      chequeUrl = signedData?.signedUrl || null;
    }

    const rateToUse = parseFloat(form.interest_rate) || companySettings?.default_interest_rate || 0;

    const { data: loanData, error } = await supabase.from('loans').insert({
      shareholder_id: form.shareholder_id,
      reference_1_id: form.reference_1 || null,
      reference_2_id: form.reference_2 || null,
      principal: parseFloat(form.principal),
      interest_rate: rateToUse / 100,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      remarks: form.remarks || null,
      tenure_months: parseInt(form.tenure_months),
      repayment_frequency: form.repayment_frequency,
      company_bank_id: (form.payment_method === 'bank') ? (form.company_bank_id || null) : null,
      cheque_number: (form.payment_method === 'bank') ? (form.cheque_number || null) : null,
      cheque_image_url: (form.payment_method === 'bank') ? chequeUrl : null,
      created_by: user?.id,
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else if (loanData) {
      // Sync with petty cash if applicable
      if (form.payment_method === 'petty_cash') {
        await supabase.from('petty_cash_ledger').insert({
          reference_id: loanData.id,
          date: form.issue_date,
          type: 'outflow',
          source: 'loan',
          amount: parseFloat(form.principal),
          description: `Loan issuance to shareholder ID: ${form.shareholder_id}`,
          created_by: user?.id
        });
      }
      // Generate Installment Schedule - Reducing Balance (EMI)
      const tenure = parseInt(form.tenure_months);
      const principal = parseFloat(form.principal);
      const annualRate = rateToUse / 100;
      const r = annualRate / 12; // Monthly Interest Rate

      const emi = r > 0 ? (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1) : principal / tenure;

      const schedule = [];
      const startDate = new Date(form.issue_date);
      let remainingPrincipal = principal;

      // Add Upfront Service Charge as installment_no 0
      const srvChargePercent = companySettings?.service_charge !== undefined ? companySettings.service_charge : 1;
      const srvCharge = principal * (srvChargePercent / 100);
      if (srvCharge > 0) {
        schedule.push({
          loan_id: loanData.id,
          installment_no: 0,
          due_date: form.issue_date,
          principal_amount: 0,
          interest_amount: 0,
          total_amount: srvCharge,
          status: form.srv_charge_method === 'deduct' ? 'paid' : 'pending'
        });
      if (srvCharge > 0 && form.srv_charge_method === 'deduct') {
        const selectedSh = shareholders.find(s => s.id === form.shareholder_id);
        const shName = selectedSh ? `${selectedSh.first_name || ''} ${selectedSh.last_name || ''}`.trim() : `ID: ${form.shareholder_id.slice(0,8)}`;
        
        const { error: srvError } = await supabase.from('investment_returns').insert({
          source_name: `Service Charge - ${shName} (Loan: ${loanData.id.slice(0,8)})`,
          gross_amount: srvCharge,
          tax_amount: 0,
          return_date: form.issue_date,
          payment_method: form.payment_method,
          company_bank_id: form.payment_method === 'bank' ? (form.company_bank_id || null) : null,
          remarks: `Upfront Service Charge for Loan ID: ${loanData.id}`,
          created_by: user?.id
        });
        if (srvError) {
          toast.error(`Service Charge ROI Error: ${srvError.message}`);
          console.error('Service Charge ROI Error:', srvError);
        }
      }
      }

      for (let i = 1; i <= tenure; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + i);
        
        const interestForMonth = remainingPrincipal * r;
        let principalForMonth = emi - interestForMonth;
        
        // Correct rounding for the last month
        if (i === tenure) {
          principalForMonth = remainingPrincipal;
        }

        schedule.push({
          loan_id: loanData.id,
          installment_no: i,
          due_date: dueDate.toISOString().split('T')[0],
          principal_amount: principalForMonth,
          interest_amount: interestForMonth,
          total_amount: principalForMonth + interestForMonth,
          status: 'pending'
        });

        remainingPrincipal -= principalForMonth;
      }

      const { error: scheduleError } = await supabase.from('loan_installments').insert(schedule);
      if (scheduleError) console.error('Schedule Error:', scheduleError);

      toast.success('Loan created with installment schedule');
      setShowModal(false);
      fetchAll();
    }
    setSaving(false);
  };

  const handleRepayClick = (loan: Loan) => {
    setActiveLoan(loan);
    
    const loanInst = allInstallments.filter(i => i.loan_id === loan.id).sort((a, b) => a.installment_no - b.installment_no);
    let funds = loan.amount_repaid;
    let runningBalance = loan.principal;
    let dueInterest = 0;

    for (const i of loanInst) {
      if (i.installment_no === 0) continue;
      const isPaid = i.status === 'paid' || funds >= i.total_amount;
      if (isPaid) {
        funds = Math.max(0, funds - i.total_amount);
        runningBalance -= i.principal_amount;
      } else {
        dueInterest = i.interest_amount;
        if (funds > 0) runningBalance -= funds;
        break;
      }
    }
    const outstanding = runningBalance + dueInterest;
    setModalOutstanding(outstanding);

    setRepayForm({
      amount: outstanding > 0 ? outstanding.toFixed(2) : '',
      payment_method: 'bank',
      payment_date: new Date().toISOString().split('T')[0],
      remarks: '',
      cheque_number: '',
      company_bank_id: ''
    });
    setReceiptFile(null);
    setReceiptPreview(null);
    setChequeFile(null);
    setChequePreview(null);
    setHistoryTab('schedule');
    setShowRepayModal(true);
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setReceiptFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    setSaving(true);

    try {
      let receiptUrl = null;
      if (receiptFile) {
        const processedFile = await processImage(receiptFile);
        const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
          ? new File([processedFile], receiptFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
          : processedFile as File;

        const fileExt = finalFile.name.split('.').pop();
        const fileName = `loan-repay/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, finalFile);

        if (uploadError) throw uploadError;
        const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
        receiptUrl = signedData?.signedUrl || null;
      }

      let chequeUrl = null;
      if (chequeFile) {
        const processedFile = await processImage(chequeFile);
        const finalFile = processedFile instanceof Blob && !(processedFile instanceof File) 
          ? new File([processedFile], chequeFile.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })
          : processedFile as File;

        const fileExt = finalFile.name.split('.').pop();
        const fileName = `loan-cheque/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, finalFile);

        if (uploadError) throw uploadError;
        const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
        chequeUrl = signedData?.signedUrl || null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const amount = parseFloat(repayForm.amount);

      // A. Fetch Pending Installments BEFORE to calculate breakdown
      const { data: pendingInst, error: instError } = await supabase
        .from('loan_installments')
        .select('*')
        .eq('loan_id', activeLoan.id)
        .eq('status', 'pending')
        .order('installment_no', { ascending: true });

      console.log('DEBUG [RepaySubmit]:', {
         loanId: activeLoan.id,
         amount: amount,
         pendingInstCount: pendingInst?.length || 0,
         pendingInst: pendingInst,
         instError: instError
      });

      let consumedInterest = 0;
      let consumedInstNumbers: number[] = [];
      let remainingPaid = amount;

      if (pendingInst && pendingInst.length > 0) {
        // Compute amortized offsets sequentially to skip implicitly paid installments
        let implicitlyPaidFunds = activeLoan.amount_repaid;

        for (const inst of pendingInst) {
          if (remainingPaid <= 0) break;
          const due = parseFloat(inst.total_amount || '0');

          // Skip installments that were already implicitly covered by previous total sum payloads 
          if (implicitlyPaidFunds >= due) {
            implicitlyPaidFunds -= due;
            continue; 
          } else if (implicitlyPaidFunds > 0) {
             // Handle any partial excess offset buffer left behind
             implicitlyPaidFunds = 0;
             // Do not consume interest on remaining offset, continue to next
          }

          console.log('DEBUG [RepayLoop]:', { instNo: inst.installment_no, due: due, remainingPaid: remainingPaid, instInterest: inst.interest_amount });
          
          if (remainingPaid >= (due - 0.01)) {
            consumedInterest += parseFloat(inst.interest_amount || '0');
            consumedInstNumbers.push(inst.installment_no);
            remainingPaid -= due;
          } else {
            // Consume remaining money proportional allocation or upfront interest
            const balanceIntr = parseFloat(inst.interest_amount || '0');
            consumedInterest += Math.min(remainingPaid, balanceIntr);
            consumedInstNumbers.push(inst.installment_no);
            remainingPaid = 0; // Fully consumed
            break;
          }
        }
      }

      const principal_component = amount - consumedInterest;
      const breakDownRemarks = `[Breakdown] Principal: Rs. ${principal_component.toFixed(2)}, Interest: Rs. ${consumedInterest.toFixed(2)}`;

      // 1. Insert Repayment Record with Breakdown (Soft Fallback)
      let { data: repayData, error: repayError } = await supabase.from('loan_repayments').insert({
        loan_id: activeLoan.id,
        amount,
        interest_amount: consumedInterest,
        principal_amount: principal_component,
        payment_date: repayForm.payment_date,
        payment_method: repayForm.payment_method,
        company_bank_id: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? (repayForm.company_bank_id || null) : null,
        cheque_number: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? (repayForm.cheque_number || null) : null,
        cheque_image_url: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? chequeUrl : null,
        receipt_url: receiptUrl,
        remarks: repayForm.remarks ? `${repayForm.remarks} | ${breakDownRemarks}` : breakDownRemarks,
        created_by: user?.id
      }).select().single();

      // Fallback if breakdown columns do not exist yet on the DB
      if (repayError && (repayError.message?.includes('interest_amount') || repayError.message?.includes('column'))) {
         const { data: legacyRepay, error: legacyError } = await supabase.from('loan_repayments').insert({
             loan_id: activeLoan.id,
             amount,
             payment_date: repayForm.payment_date,
             payment_method: repayForm.payment_method,
             company_bank_id: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? (repayForm.company_bank_id || null) : null,
             cheque_number: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? (repayForm.cheque_number || null) : null,
             cheque_image_url: (repayForm.payment_method === 'bank' || repayForm.payment_method === 'check') ? chequeUrl : null,
             receipt_url: receiptUrl,
             remarks: repayForm.remarks ? `${repayForm.remarks} | ${breakDownRemarks}` : breakDownRemarks,
             created_by: user?.id
         }).select().single();
         repayData = legacyRepay;
         repayError = legacyError;
      }

      if (repayError) throw repayError;

      // Sync with petty cash ledger if applicable
      if (repayForm.payment_method === 'petty_cash' && repayData) {
        await supabase.from('petty_cash_ledger').insert({
          reference_id: repayData.id,
          date: repayForm.payment_date,
          type: 'inflow',
          source: 'loan_repayment',
          amount: amount,
          description: `Loan repayment from ${activeLoan.shareholders.first_name} ${activeLoan.shareholders.last_name}`,
          created_by: user?.id
        });
      }

      // 2. Update Loan Balance
      const newRepaid = activeLoan.amount_repaid + amount;
      const newStatus = newRepaid >= activeLoan.principal ? 'closed' : 'active';
      const { error: loanUpdateError } = await supabase
        .from('loans')
        .update({ amount_repaid: newRepaid, status: newStatus })
        .eq('id', activeLoan.id);

      if (loanUpdateError) throw loanUpdateError;

      // 3. Mark Installments as Paid
      if (consumedInstNumbers.length > 0) {
        await supabase
          .from('loan_installments')
          .update({ status: 'paid' })
          .eq('loan_id', activeLoan.id)
          .in('installment_no', consumedInstNumbers);
      }

      // Automatic insert into investment_returns for Interest ROI
      if (consumedInterest > 0) {
        const { error: roiError } = await supabase.from('investment_returns').insert({
          source_name: `Loan Interest - ${activeLoan.shareholders?.first_name || ''} ${activeLoan.shareholders?.last_name || ''} (ID: ${activeLoan.id.slice(0,8)})`,
          gross_amount: consumedInterest,
          tax_amount: 0,
          return_date: repayForm.payment_date || new Date().toISOString().split('T')[0],
          payment_method: repayForm.payment_method,
          company_bank_id: (repayForm.payment_method === 'bank') ? (repayForm.company_bank_id || null) : null,
          remarks: `Interest component of Loan ID: ${activeLoan.id} - Installment No(s): ${consumedInstNumbers.join(', ')}`,
          created_by: user?.id
        });

        if (roiError) throw roiError;
      }
      
      toast.success(`Repayment of Rs. ${amount.toLocaleString()} recorded`);
      setShowRepayModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Repayment failed');
    } finally {
      setSaving(false);
    }
  };

  const fetchLoanHistory = async (loan: Loan) => {
    setActiveLoan(loan);
    setHistoryLoading(true);
    setHistoryTab('schedule');
    setShowHistoryModal(true);
    
    const [repayRes, instRes] = await Promise.all([
      supabase.from('loan_repayments').select('*').eq('loan_id', loan.id).order('payment_date', { ascending: false }),
      supabase.from('loan_installments').select('*').eq('loan_id', loan.id).order('installment_no', { ascending: true })
    ]);

    setRepayments(repayRes.data || []);
    setInstallments(instRes.data || []);
    setHistoryLoading(false);
  };

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const statusBadge = (s: string) => s === 'closed' ? 'badge-success' : s === 'overdue' ? 'badge-danger' : 'badge-warning';

  const filtered = loans.filter(l => {
    const d = l.issue_date;
    const name = `${l.shareholders?.first_name || ''} ${l.shareholders?.last_name || ''}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || (l.remarks || '').toLowerCase().includes(search.toLowerCase());
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return matchesSearch;
  });

  const totalOutstanding = loans.filter(l => l.status === 'active').reduce((s, l) => s + (l.principal - l.amount_repaid), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loans</h1>
          <p className="page-subtitle">{loans.length} loans &bull; Outstanding: {formatCurrency(totalOutstanding)}</p>
          <div className="print-period">
            Period: from <strong>{startDate ? adToBs(startDate) : '..................'}</strong> to <strong>{endDate ? adToBs(endDate) : '..................'}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary no-print" onClick={() => { 
            setForm({ 
              shareholder_id: '', 
              reference_1: '', 
              reference_2: '', 
              principal: '', 
              interest_rate: '0', 
              issue_date: new Date().toISOString().split('T')[0], 
              due_date: '', 
              remarks: '',
              tenure_months: '12',
              repayment_frequency: 'monthly',
              company_bank_id: '',
              payment_method: 'bank',
              cheque_number: '',
              srv_charge_method: 'deduct' as 'deduct' | 'separate',
            }); 
            setLoanChequeFile(null);
            setLoanChequePreview(null);
            setShowModal(true); 
          }}>
            <Plus size={16} /> Issue Loan
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="search-bar no-print flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div className="flex gap-4">
            <div className="search-input-wrapper" style={{ minWidth: 250 }}>
              <Search size={16} />
              <input className="input" placeholder="Search loans..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">From:</label>
               <NepaliDateInput value={startDate} onChange={(ad) => setStartDate(ad)} />
            </div>
            <div className="flex items-center gap-2">
               <label className="text-sm text-muted">To:</label>
               <NepaliDateInput value={endDate} onChange={(ad) => setEndDate(ad)} />
            </div>
            {(startDate || endDate || search) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}>Clear</button>
            )}
          </div>
        </div>
        {loading ? <div className="card">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />)}</div> : loans.length === 0 ? (
          <div className="card empty-state"><Wallet size={48} /><h3>No loans issued</h3><p>Issue loans to shareholders against their share value.</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Shareholder</th><th>Principal</th><th>Rate</th><th>Repaid</th><th>Outstanding</th><th>Due Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map((l) => {
                  const loanInst = allInstallments.filter(i => i.loan_id === l.id).sort((a, b) => a.installment_no - b.installment_no);
                  let funds = l.amount_repaid;
                  let runningBalance = l.principal;
                  let dueInterest = 0;

                  for (const i of loanInst) {
                    if (i.installment_no === 0) {
                      // Upfront charges paid deducted from disbursement do not consume from the repayments cash pool
                      continue;
                    }
                    const isPaid = i.status === 'paid' || funds >= i.total_amount;
                    if (isPaid) {
                      funds = Math.max(0, funds - i.total_amount);
                      runningBalance -= i.principal_amount;
                    } else {
                      dueInterest = i.interest_amount;
                      if (funds > 0) {
                        runningBalance -= funds;
                      }
                      break;
                    }
                  }
                  const accurateOutstanding = runningBalance + dueInterest;

                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{l.shareholders.first_name} {l.shareholders.last_name}</td>
                      <td>{formatCurrency(l.principal)}</td>
                      <td>{(l.interest_rate * 100).toFixed(2)}%</td>
                      <td style={{ color: 'var(--success)' }}>{formatCurrency(l.amount_repaid)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(accurateOutstanding)}</td>
                    <td>{l.due_date ? adToBs(l.due_date) : '—'}</td>
                    <td><span className={`badge ${statusBadge(l.status)}`}>{l.status}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => fetchLoanHistory(l)}>History</button>
                        {l.status === 'active' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleRepayClick(l)} style={{ color: 'var(--success)' }}>Repay</button>
                        )}
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header"><h2 className="modal-title">Issue Loan</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                {(() => {
                  const borrowerInv = shareholders.find(s => s.id === form.shareholder_id)?.total_investment || 0;
                  const ref1Inv = shareholders.find(s => s.id === form.reference_1)?.total_investment || 0;
                  const ref2Inv = shareholders.find(s => s.id === form.reference_2)?.total_investment || 0;
                  const pool = borrowerInv + ref1Inv + ref2Inv;
                  const limit = pool * (loanMaxPercentage / 100);

                  return (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 20 }}>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <strong>Max Loan Limit:</strong> {loanMaxPercentage}% of total (Borrower + Refs) shares = <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Rs. {limit.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </p>
                      {form.principal && parseFloat(form.principal) > limit && (
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--danger)' }}>⚠️ Requested amount exceeds the allowed maximum limit.</p>
                      )}
                    </div>
                  );
                })()}

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="input-group" style={{ gridColumn: 'span 2' }}>
                    <label>Borrower <span className="required">*</span></label>
                    <select className="select" value={form.shareholder_id} onChange={(e) => setForm(p => ({ ...p, shareholder_id: e.target.value }))} required>
                      <option value="">Select Borrower...</option>
                      {shareholders.map(sh => {
                        const isLocked = loans.some(l => 
                          l.status === 'active' && 
                          (l.shareholder_id === sh.id || l.reference_1_id === sh.id || l.reference_2_id === sh.id)
                        );
                        return (
                          <option key={sh.id} value={sh.id} disabled={isLocked}>
                            {sh.first_name} {sh.last_name} (Rs. {sh.total_investment.toLocaleString()}) {isLocked ? '— (Already Involved in Active Loan)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  <div className="input-group">
                    <label>Reference 1 <span className="required">*</span></label>
                    <select className="select" value={form.reference_1} onChange={(e) => setForm(p => ({ ...p, reference_1: e.target.value }))} required>
                      <option value="">Select Reference...</option>
                      {shareholders
                        .filter(s => s.id !== form.shareholder_id && s.id !== form.reference_2)
                        .map(sh => {
                          const isLocked = loans.some(l => 
                            l.status === 'active' && 
                            (l.shareholder_id === sh.id || l.reference_1_id === sh.id || l.reference_2_id === sh.id)
                          );
                          return (
                            <option key={sh.id} value={sh.id} disabled={isLocked}>
                              {sh.first_name} {sh.last_name} (Rs. {sh.total_investment.toLocaleString()}) {isLocked ? '— (Booked)' : ''}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Reference 2 <span className="required">*</span></label>
                    <select className="select" value={form.reference_2} onChange={(e) => setForm(p => ({ ...p, reference_2: e.target.value }))} required>
                      <option value="">Select Reference...</option>
                      {shareholders
                        .filter(s => s.id !== form.shareholder_id && s.id !== form.reference_1)
                        .map(sh => {
                          const isLocked = loans.some(l => 
                            l.status === 'active' && 
                            (l.shareholder_id === sh.id || l.reference_1_id === sh.id || l.reference_2_id === sh.id)
                          );
                          return (
                            <option key={sh.id} value={sh.id} disabled={isLocked}>
                              {sh.first_name} {sh.last_name} (Rs. {sh.total_investment.toLocaleString()}) {isLocked ? '— (Booked)' : ''}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <hr style={{ gridColumn: 'span 2', borderColor: 'var(--border)', margin: '8px 0' }} />

                  <div className="input-group">
                    <label className="flex justify-between items-center">
                      <span>Principal (Rs.) <span className="required">*</span></span>
                      {currentSelectedBalance !== null && !fetchingBalance && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: (parseFloat(form.principal) || 0) > currentSelectedBalance ? 'var(--danger)' : 'var(--primary-light)' }}>
                          Bal: Rs. {currentSelectedBalance.toLocaleString()}
                        </span>
                      )}
                      {fetchingBalance && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Checking balance...</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.principal} onChange={(e) => setForm(p => ({ ...p, principal: e.target.value }))} required placeholder="0.00" />
                  </div>
                  {/* Interest rate removed since pulled from Settings */}
                  
                  <div className="input-group">
                    <label>Issue Date (BS)</label>
                    <NepaliDateInput 
                      value={form.issue_date} 
                      onChange={(ad) => setForm(p => ({ ...p, issue_date: ad }))} 
                      align="left"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Due Date (BS)</label>
                    <input className="input" value={form.due_date ? adToBs(form.due_date) : ''} disabled style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} />
                  </div>
                  
                  <div className="input-group">
                    <label>Tenure (Months)</label>
                    <input type="number" className="input" value={form.tenure_months} onChange={(e) => setForm(p => ({ ...p, tenure_months: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label>Frequency</label>
                    <select className="select" value={form.repayment_frequency} onChange={(e) => setForm(p => ({ ...p, repayment_frequency: e.target.value }))}>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                   <div className="input-group" style={{ gridColumn: 'span 2' }}><label>Remarks</label><input className="input" value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Loan purpose..." /></div>
                  
                  <div className="input-group">
                    <label>Disbursement Method</label>
                    <select className="select" value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value, company_bank_id: '' }))}>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Upfront Service Charge</label>
                    <select className="select" value={form.srv_charge_method} onChange={(e) => setForm(p => ({ ...p, srv_charge_method: e.target.value as 'deduct' | 'separate' }))}>
                      <option value="deduct">Deduct from disbursement</option>
                      <option value="separate">Pay separately (Add to schedule)</option>
                    </select>
                  </div>

                  {form.payment_method === 'bank' && (
                    <div className="input-group">
                      <label>Select Company Bank</label>
                      <select className="select" value={form.company_bank_id} onChange={(e) => setForm(p => ({ ...p, company_bank_id: e.target.value }))} required>
                        <option value="">Select bank...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.company_bank_id && (
                    <>
                      <div className="input-group">
                        <label>Cheque Number {loadingCheques && <span style={{ fontSize: 10, color: 'var(--primary)' }}>(Loading...)</span>}</label>
                        <select 
                          className="select" 
                          value={form.cheque_number || ''} 
                          onChange={(e) => setForm(p => ({ ...p, cheque_number: e.target.value }))}
                          disabled={loadingCheques}
                        >
                          <option value="">Select cheque...</option>
                          {availableCheques.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Cheque Receipt Image</label>
                        <input type="file" className="input" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setLoanChequeFile(file);
                          if (file && file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setLoanChequePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} accept="image/*,.pdf" />
                        {loanChequePreview && (
                          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                            <img src={loanChequePreview} alt="Cheque Preview" style={{ width: '100%', maxHeight: 80, objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Issue Loan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepayModal && activeLoan && (
        <div className="modal-overlay" onClick={() => setShowRepayModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header"><h2 className="modal-title">Record Repayment</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowRepayModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleRepaySubmit}>
              <div className="modal-body">
                <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 13 }}><strong>Active Loan:</strong> {activeLoan.shareholders.first_name} {activeLoan.shareholders.last_name}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13 }}><strong>Outstanding:</strong> {formatCurrency(modalOutstanding)}</p>
                  {repayForm.amount && (
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: (modalOutstanding - (parseFloat(repayForm.amount) || 0)) <= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      <strong>Remaining Balance:</strong> {formatCurrency(Math.max(0, modalOutstanding - (parseFloat(repayForm.amount) || 0)))}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="input-group">
                    <label>Amount (Rs.) <span className="required">*</span></label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.01" 
                      max={modalOutstanding.toFixed(2)} 
                      className="input" 
                      value={repayForm.amount} 
                      onChange={(e) => setRepayForm(p => ({ ...p, amount: e.target.value }))} 
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label>Method <span className="required">*</span></label>
                    <select className="select" value={repayForm.payment_method} onChange={(e) => setRepayForm(p => ({ ...p, payment_method: e.target.value, company_bank_id: '' }))}>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  {repayForm.payment_method === 'bank' && (
                    <div className="input-group">
                      <label>Select Bank <span className="required">*</span></label>
                      <select className="select" value={repayForm.company_bank_id} onChange={(e) => setRepayForm(p => ({ ...p, company_bank_id: e.target.value }))} required>
                        <option value="">Select bank account...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="input-group">
                    <label>Payment Date (BS)</label>
                    <NepaliDateInput 
                      value={repayForm.payment_date} 
                      onChange={(ad) => setRepayForm(p => ({ ...p, payment_date: ad }))} 
                      align="right"
                    />
                  </div>
                  <div className="input-group">
                    <label>Upload Receipt</label>
                    <input type="file" className="input" onChange={handleFileChange} accept="image/*,.pdf" />
                  </div>
                  
                  {receiptPreview && (
                    <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <p style={{ margin: '4px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>Preview:</p>
                      <img src={receiptPreview} alt="Receipt Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#000' }} />
                    </div>
                  )}

                  <div className="input-group"><label>Remarks</label><input className="input" value={repayForm.remarks} onChange={(e) => setRepayForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Payment details..." /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRepayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Saving...' : 'Confirm Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && activeLoan && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Loan Schedule & History</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{activeLoan.shareholders.first_name} {activeLoan.shareholders.last_name} &bull; {formatCurrency(activeLoan.principal)}</p>
              </div>
              <div className="flex gap-2 no-print">
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => window.print()}>
                  <Printer size={14} style={{ marginRight: 6 }} /> Print
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowHistoryModal(false)}><X size={18} /></button>
              </div>
            </div>
            <div className="modal-body print-section" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
              <div className="tabs no-print" style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 20, position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 30, padding: '12px 0' }}>
                <button 
                  className={`tab-btn ${historyTab === 'schedule' ? 'active' : ''}`} 
                  onClick={() => setHistoryTab('schedule')}
                  style={{ padding: '8px 4px', borderBottom: historyTab === 'schedule' ? '2px solid var(--primary)' : 'none', color: historyTab === 'schedule' ? 'var(--primary)' : 'var(--text-secondary)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Schedule
                </button>
                <button 
                  className={`tab-btn ${historyTab === 'repayments' ? 'active' : ''}`} 
                  onClick={() => setHistoryTab('repayments')}
                  style={{ padding: '8px 4px', borderBottom: historyTab === 'repayments' ? '2px solid var(--primary)' : 'none', color: historyTab === 'repayments' ? 'var(--primary)' : 'var(--text-secondary)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Repayments
                </button>
              </div>

              {historyLoading ? <p>Loading...</p> : (
                <div className="space-y-6">
                  {historyTab === 'schedule' && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Installment Schedule</h3>
                      <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table className="table no-bg">
                          <thead>
                            <tr>
                              <th>No.</th>
                              <th>Due Date</th>
                              <th>Beginning Balance</th>
                              <th>Interest Amount</th>
                              <th>Installment Amount</th>
                              <th>Principal Portion</th>
                              <th>Closing Balance</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {installments.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center' }}>No schedule generated.</td></tr> : (() => {
                              let runningBalance = activeLoan.principal;
                              let availableFunds = activeLoan.amount_repaid; // Total repayments recorded so far
                              let cumulativeRepaid = activeLoan.amount_repaid; // Track exact consumption
                              
                              return installments.map(i => {
                                const starting = runningBalance;
                                runningBalance -= i.principal_amount;
                                
                                const isUpfront = i.installment_no === 0;
                                const isPaid = i.status === 'paid' || availableFunds >= i.total_amount || activeLoan.status === 'closed';
                                
                                if (!isUpfront) {
                                  if (availableFunds >= i.total_amount) {
                                    availableFunds -= i.total_amount;
                                    cumulativeRepaid -= i.total_amount;
                                  } else {
                                    // There is some excess right here that wasn't enough to pay the NEXT installment fully!
                                    // Subtract that partial excess from the runningBalance directly!
                                    if (availableFunds > 0) {
                                      runningBalance -= availableFunds;
                                      availableFunds = 0; // consumed
                                    }
                                  }
                                }

                                let penaltyMessage = '';
                                if (!isPaid && !isUpfront) {
                                  const today = new Date();
                                  const due = new Date(i.due_date);
                                  const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                                  const grace = companySettings?.grace_period || 0;
                                  if (diffDays > grace) {
                                    const penaltyRate = companySettings?.penalty_percent || 0;
                                    const penalty = activeLoan.principal * (penaltyRate / 100);
                                    penaltyMessage = penaltyRate > 0 ? ` - Rs. ${penalty.toLocaleString()}` : '';
                                  }
                                }

                                return (
                                  <tr key={i.id} style={isUpfront ? { background: 'var(--bg-secondary)', fontWeight: 500 } : {}}>
                                    <td>{isUpfront ? 'Upfront' : i.installment_no}</td>
                                    <td>{adToBs(i.due_date)}</td>
                                    <td>{isUpfront ? '—' : formatCurrency(starting)}</td>
                                    <td>{isUpfront ? '—' : formatCurrency(i.interest_amount)}</td>
                                    <td style={{ fontWeight: 600 }}>{formatCurrency(i.total_amount)}</td>
                                    <td>{isUpfront ? '—' : formatCurrency(i.principal_amount)}</td>
                                    <td style={{ color: 'var(--danger)' }}>{isUpfront ? '—' : formatCurrency(Math.max(0, runningBalance))}</td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className={`badge ${isPaid ? 'badge-success' : 'badge-neutral'}`}>
                                          {isPaid ? 'paid' : 'pending'}
                                        </span>
                                        {!isPaid && (
                                          <button 
                                            className="btn btn-ghost btn-xs text-primary no-print" 
                                            style={{ padding: '2px 6px', height: 'auto', fontSize: 11, fontWeight: 600 }}
                                            onClick={() => {
                                              setRepayForm({
                                                amount: String(i.total_amount),
                                                payment_method: 'bank',
                                                company_bank_id: '',
                                                remarks: `Repayment for installment no: ${i.installment_no}`,
                                                payment_date: new Date().toISOString().split('T')[0],
                                                cheque_number: ''
                                              });
                                              setShowRepayModal(true);
                                              setShowHistoryModal(false); // Close current view trigger
                                            }}
                                          >
                                            Pay
                                          </button>
                                        )}
                                      </div>
                                      {penaltyMessage && <div style={{ color: 'var(--danger)', fontSize: 10, marginTop: 4, fontWeight: 600 }}>Penalty{penaltyMessage}</div>}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {historyTab === 'repayments' && (
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Repayment History</h3>
                      <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table className="table no-bg">
                          <thead><tr><th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 20 }}>Date</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 20 }}>Method</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 20 }}>Amount</th><th style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 20 }}>Receipt</th></tr></thead>
                          <tbody>
                            {repayments.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>No payments recorded yet.</td></tr> : repayments.map(r => (
                              <tr key={r.id}>
                                <td>{adToBs(r.payment_date)}</td>
                                <td style={{ textTransform: 'capitalize' }}>{r.payment_method}</td>
                                <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(r.amount)}</td>
                                <td>
                                  {r.receipt_url ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <a href={r.receipt_url} target="_blank" rel="noreferrer" className="badge badge-info" style={{ textDecoration: 'none' }}>View</a>
                                      {r.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                                        <img 
                                          src={r.receipt_url} 
                                          alt="Thumbnail" 
                                          style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }} 
                                          onClick={() => window.open(r.receipt_url!, '_blank')}
                                        />
                                      )}
                                    </div>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .table-container { 
          overflow-x: auto; 
          max-width: 100%;
        }
        .table-container table thead th {
          position: sticky;
          top: 0;
          background: var(--bg-primary, #fff);
          z-index: 20;
          box-shadow: inset 0 -1px 0 var(--border);
        }
        @page { margin: 0; }
        @media print {
          .no-print, .sidebar, .sidebar-toggle, .sidebar-overlay, #mobile-sidebar-toggle, .theme-toggle-btn { display: none !important; }
          body { background: white !important; padding: 0.5in !important; margin: 0 !important; color: black !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .page-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .table-container { border: none !important; overflow: visible !important; }
          .table th { background: #f5f5f5 !important; border: 1px solid #ccc !important; position: static !important; }
          .table td { border: 1px solid #eee !important; color: black !important; padding: 8px !important; }
          .print-period { display: block !important; margin-top: 10px; font-size: 11pt; }
        }
        .print-period { display: none; }
      `}</style>
    </>
  );
}
