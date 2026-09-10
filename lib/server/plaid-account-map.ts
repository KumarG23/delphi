export type DelphiAccountCategory = 'debt' | 'cash' | 'investment';
export type DelphiAccountType =
  | 'credit_card'
  | 'personal_loan'
  | 'mortgage'
  | 'auto_loan'
  | 'student_loan'
  | 'other_debt'
  | 'checking'
  | 'savings'
  | 'hysa'
  | 'money_market'
  | 'cash_other'
  | '401k'
  | 'traditional_ira'
  | 'roth_ira'
  | 'brokerage'
  | 'crypto'
  | 'investment_other';

export type DelphiAccountClassification = {
  category: DelphiAccountCategory;
  type: DelphiAccountType;
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

export function classifyPlaidAccount(
  plaidType: string,
  plaidSubtype?: string | null,
): DelphiAccountClassification {
  const type = normalize(plaidType);
  const subtype = normalize(plaidSubtype);

  if (type === 'credit') {
    return { category: 'debt', type: 'credit_card' };
  }

  if (type === 'loan') {
    if (subtype.includes('mortgage')) return { category: 'debt', type: 'mortgage' };
    if (subtype.includes('auto')) return { category: 'debt', type: 'auto_loan' };
    if (subtype.includes('student')) return { category: 'debt', type: 'student_loan' };
    if (subtype.includes('personal')) return { category: 'debt', type: 'personal_loan' };
    return { category: 'debt', type: 'other_debt' };
  }

  if (type === 'investment') {
    if (subtype.includes('401k') || subtype.includes('401_k')) {
      return { category: 'investment', type: '401k' };
    }
    if (subtype.includes('roth')) return { category: 'investment', type: 'roth_ira' };
    if (subtype.includes('ira')) return { category: 'investment', type: 'traditional_ira' };
    if (subtype.includes('crypto')) return { category: 'investment', type: 'crypto' };
    if (subtype.includes('brokerage') || subtype.includes('taxable')) {
      return { category: 'investment', type: 'brokerage' };
    }
    return { category: 'investment', type: 'investment_other' };
  }

  if (type === 'depository') {
    if (subtype.includes('checking')) return { category: 'cash', type: 'checking' };
    if (subtype.includes('money_market')) return { category: 'cash', type: 'money_market' };
    if (subtype.includes('savings')) return { category: 'cash', type: 'savings' };
    return { category: 'cash', type: 'cash_other' };
  }

  // Plaid can return "other" for uncommon account types. Treat those as cash
  // rather than debt so Delphi never invents a liability classification.
  return { category: 'cash', type: 'cash_other' };
}
