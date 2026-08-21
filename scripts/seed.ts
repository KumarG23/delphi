/**
 * Delphi — Dev Seed Script
 *
 * Inserts realistic test data for local development.
 *
 * Prerequisites:
 *   npm install dotenv tsx          (one-time, if not already installed)
 *
 * Usage:
 *   Set SEED_EMAIL and SEED_PASSWORD in your .env file, then run:
 *   npx tsx scripts/seed.ts
 *
 * The script signs in as the given user and inserts:
 *   • 5 seed accounts  (institution = '_seed_' so they are easy to identify)
 *   • 300 daily balance snapshots  (60 per account × 60 days)
 *   • 100 transactions  (expenses, income, misc)
 *
 * To re-seed: delete accounts with institution = '_seed_' in Supabase, then
 * run the script again.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ─── env ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL         = process.env.SEED_EMAIL;
const PASSWORD      = process.env.SEED_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error('Missing SEED_EMAIL or SEED_PASSWORD in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function noise(base: number, pct: number): number {
  return base + (Math.random() - 0.5) * 2 * base * pct;
}

// ─── account definitions ─────────────────────────────────────────────────────

interface AccountDef {
  name: string;
  category: 'debt' | 'cash' | 'investment';
  type: string;
  startBalance: number;
  trend: 'paydown' | 'flat' | 'fluctuate' | 'grow' | 'volatile';
  apr?: number;
  apy?: number;
}

const ACCOUNT_DEFS: AccountDef[] = [
  {
    name: 'Chase Sapphire',
    category: 'debt',
    type: 'credit_card',
    startBalance: 4500,
    trend: 'paydown',
    apr: 24.99,
  },
  {
    name: 'Capital One Venture',
    category: 'debt',
    type: 'credit_card',
    startBalance: 1800,
    trend: 'flat',
    apr: 22.49,
  },
  {
    name: 'Chase Checking',
    category: 'cash',
    type: 'checking',
    startBalance: 3200,
    trend: 'fluctuate',
  },
  {
    name: 'Ally HYSA',
    category: 'cash',
    type: 'hysa',
    startBalance: 12000,
    trend: 'grow',
    apy: 4.20,
  },
  {
    name: 'Fidelity 401k',
    category: 'investment',
    type: '401k',
    startBalance: 45000,
    trend: 'volatile',
  },
];

// ─── balance generation ───────────────────────────────────────────────────────

function generateBalances(def: AccountDef): number[] {
  const balances: number[] = [];
  let b = def.startBalance;

  for (let i = 0; i < 60; i++) {
    switch (def.trend) {
      case 'paydown':
        // paying off credit card: slight downward trend
        b = b - rand(20, 80) + rand(0, 30);
        b = Math.max(200, b);
        break;
      case 'flat':
        b = noise(def.startBalance, 0.05);
        break;
      case 'fluctuate':
        b = b + rand(-250, 300);
        b = Math.max(500, b);
        break;
      case 'grow':
        // HYSA growing slowly
        b = b + rand(10, 60);
        break;
      case 'volatile':
        // 401k: general upward trend with market noise
        b = b + rand(-600, 900);
        b = Math.max(30000, b);
        break;
    }
    balances.unshift(Math.round(b * 100) / 100); // oldest first after reversing
  }

  return balances; // index 0 = 59 days ago, index 59 = today
}

// ─── transaction data ─────────────────────────────────────────────────────────

const EXPENSE_MERCHANTS: { merchant: string; categoryName: string; minAmt: number; maxAmt: number }[] = [
  { merchant: 'Whole Foods Market',    categoryName: 'Groceries',      minAmt: 45,  maxAmt: 180 },
  { merchant: "Trader Joe's",          categoryName: 'Groceries',      minAmt: 30,  maxAmt: 120 },
  { merchant: 'Costco',                categoryName: 'Groceries',      minAmt: 80,  maxAmt: 250 },
  { merchant: "McDonald's",            categoryName: 'Dining',         minAmt: 8,   maxAmt: 30  },
  { merchant: 'Chipotle',              categoryName: 'Dining',         minAmt: 10,  maxAmt: 25  },
  { merchant: 'Starbucks',             categoryName: 'Dining',         minAmt: 5,   maxAmt: 15  },
  { merchant: 'DoorDash',              categoryName: 'Dining',         minAmt: 25,  maxAmt: 65  },
  { merchant: 'Uber Eats',             categoryName: 'Dining',         minAmt: 20,  maxAmt: 60  },
  { merchant: 'Shell Gas Station',     categoryName: 'Transportation', minAmt: 40,  maxAmt: 80  },
  { merchant: 'EZPass',                categoryName: 'Transportation', minAmt: 10,  maxAmt: 30  },
  { merchant: 'Uber',                  categoryName: 'Transportation', minAmt: 12,  maxAmt: 45  },
  { merchant: 'Con Edison',            categoryName: 'Utilities',      minAmt: 60,  maxAmt: 140 },
  { merchant: 'Verizon',               categoryName: 'Utilities',      minAmt: 45,  maxAmt: 90  },
  { merchant: 'Netflix',               categoryName: 'Subscriptions',  minAmt: 15,  maxAmt: 23  },
  { merchant: 'Spotify',               categoryName: 'Subscriptions',  minAmt: 10,  maxAmt: 11  },
  { merchant: 'Apple iCloud',          categoryName: 'Subscriptions',  minAmt: 3,   maxAmt: 10  },
  { merchant: 'Amazon Prime',          categoryName: 'Subscriptions',  minAmt: 14,  maxAmt: 15  },
  { merchant: 'CVS Pharmacy',          categoryName: 'Healthcare',     minAmt: 15,  maxAmt: 80  },
  { merchant: 'Duane Reade',           categoryName: 'Healthcare',     minAmt: 10,  maxAmt: 60  },
  { merchant: 'Amazon',                categoryName: 'Shopping',       minAmt: 20,  maxAmt: 200 },
  { merchant: 'Target',                categoryName: 'Shopping',       minAmt: 25,  maxAmt: 120 },
  { merchant: 'H&M',                   categoryName: 'Shopping',       minAmt: 30,  maxAmt: 150 },
];

const INCOME_MERCHANTS = [
  { merchant: 'Employer Payroll',   minAmt: 4200, maxAmt: 4200 },
  { merchant: 'Freelance Payment',  minAmt: 300,  maxAmt: 800  },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Delphi seed script starting…\n');

  // 1. Sign in
  console.log(`Signing in as ${EMAIL}…`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: EMAIL!,
    password: PASSWORD!,
  });
  if (authError || !authData.session) {
    console.error('Auth failed:', authError?.message ?? 'No session returned');
    process.exit(1);
  }
  const userId = authData.session.user.id;
  console.log(`✓ Signed in. User ID: ${userId}\n`);

  // 2. Check for existing seed data
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('institution', '_seed_')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(
      '⚠️  Seed data already exists.\n' +
      '   Delete accounts with institution = \'_seed_\' in Supabase to re-seed, then run again.',
    );
    process.exit(0);
  }

  // 3. Fetch categories (needed to link transactions)
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (catError) {
    console.error('Could not fetch categories:', catError.message);
    console.log('Transactions will be created without category links.');
  }

  const catMap: Record<string, string> = {};
  for (const c of categories ?? []) {
    catMap[c.name.toLowerCase()] = c.id;
  }

  function findCategory(name: string): string | null {
    // Try exact match first
    const key = name.toLowerCase();
    if (catMap[key]) return catMap[key];
    // Try partial match
    for (const [k, id] of Object.entries(catMap)) {
      if (k.includes(key) || key.includes(k)) return id;
    }
    return null;
  }

  // 4. Create accounts
  console.log('Creating 5 accounts…');
  const accountIds: string[] = [];
  const accountTypeMap: Record<string, 'debt' | 'cash' | 'investment'> = {};

  for (const def of ACCOUNT_DEFS) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: def.name,
        category: def.category,
        type: def.type as any,
        institution: '_seed_',
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error(`  ✗ Failed to create account "${def.name}":`, error?.message);
      process.exit(1);
    }

    accountIds.push(data.id);
    accountTypeMap[data.id] = def.category;
    console.log(`  ✓ ${def.name} (${def.category})`);
  }

  // 5. Create balance snapshots — 60 days per account
  console.log('\nCreating 300 balance snapshots (60 per account × 5 accounts)…');
  let snapshotCount = 0;

  for (let ai = 0; ai < ACCOUNT_DEFS.length; ai++) {
    const def = ACCOUNT_DEFS[ai];
    const accountId = accountIds[ai];
    const balances = generateBalances(def);

    const rows = balances.map((balance, idx) => ({
      account_id: accountId,
      user_id: userId,
      snapshot_date: daysAgo(59 - idx),
      balance,
      apr: def.apr ?? null,
      apy: def.apy ?? null,
      is_active: true,
    }));

    // Insert in batches of 30
    for (let i = 0; i < rows.length; i += 30) {
      const batch = rows.slice(i, i + 30);
      const { error } = await supabase.from('balance_snapshots').insert(batch);
      if (error) {
        console.error(`  ✗ Snapshot batch error for ${def.name}:`, error.message);
      } else {
        snapshotCount += batch.length;
      }
    }

    console.log(`  ✓ ${def.name}: ${balances.length} snapshots`);
  }

  // 6. Create transactions — 100 total over last 60 days
  console.log('\nCreating 100 transactions…');

  // Identify cash/debt account ids for linking
  const checkingId  = accountIds[2]; // Chase Checking
  const sapphireId  = accountIds[0]; // Chase Sapphire
  const spendingAccountIds = [checkingId, sapphireId];

  const txRows: any[] = [];

  // ~75 expenses
  for (let i = 0; i < 75; i++) {
    const merchant = pick(EXPENSE_MERCHANTS);
    const amount   = Math.round(rand(merchant.minAmt, merchant.maxAmt) * 100) / 100;
    const catId    = findCategory(merchant.categoryName);

    txRows.push({
      user_id:          userId,
      account_id:       pick(spendingAccountIds),
      category_id:      catId,
      transaction_date: daysAgo(randInt(0, 59)),
      amount,
      kind:             'expense',
      merchant:         merchant.merchant,
      source:           'manual',
      is_active:        true,
    });
  }

  // ~20 income: 2 salary entries per month for ~2 months = 4, rest freelance
  // 2 months × 2 paychecks each
  const salaryDates = [2, 16, 32, 46]; // days ago for bimonthly-ish paydays
  for (const dAgo of salaryDates) {
    txRows.push({
      user_id:          userId,
      account_id:       checkingId,
      category_id:      findCategory('salary') ?? findCategory('income'),
      transaction_date: daysAgo(dAgo),
      amount:           4200,
      kind:             'income',
      merchant:         'Employer Payroll',
      description:      'Direct deposit',
      source:           'manual',
      is_active:        true,
    });
  }

  // Remaining ~16 income as freelance/misc
  for (let i = 0; i < 16; i++) {
    const inc = pick(INCOME_MERCHANTS);
    txRows.push({
      user_id:          userId,
      account_id:       checkingId,
      category_id:      findCategory('income') ?? findCategory('side'),
      transaction_date: daysAgo(randInt(0, 59)),
      amount:           Math.round(rand(inc.minAmt, inc.maxAmt) * 100) / 100,
      kind:             'income',
      merchant:         inc.merchant,
      source:           'manual',
      is_active:        true,
    });
  }

  // ~5 misc transfers/other
  for (let i = 0; i < 5; i++) {
    txRows.push({
      user_id:          userId,
      account_id:       checkingId,
      category_id:      null,
      transaction_date: daysAgo(randInt(0, 59)),
      amount:           Math.round(rand(50, 500) * 100) / 100,
      kind:             'transfer',
      merchant:         pick(['Venmo', 'Zelle Transfer', 'ACH Transfer']),
      source:           'manual',
      is_active:        true,
    });
  }

  // Insert transactions in batches of 25
  let txCount = 0;
  for (let i = 0; i < txRows.length; i += 25) {
    const batch = txRows.slice(i, i + 25);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) {
      console.error(`  ✗ Transaction batch error:`, error.message);
    } else {
      txCount += batch.length;
    }
  }

  console.log(`  ✓ ${txCount} transactions inserted`);

  // 7. Done
  console.log(
    `\n✓ Seed complete! 5 accounts, ${snapshotCount} snapshots, ${txCount} transactions created.`,
  );
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
