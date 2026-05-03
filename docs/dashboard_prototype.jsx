// ═══════════════════════════════════════════════════════════════════════════
//  DELPHI · DASHBOARD VISUAL REFERENCE
// ───────────────────────────────────────────────────────────────────────────
//  This is the PROTOTYPE we locked in during design. It's a self-contained
//  React component (web JSX, not React Native) used here only to show
//  the visual direction — proportions, colors, spacing, interaction patterns.
//
//  DO NOT SHIP THIS FILE. Use it as the picture to draw from when building
//  the real dashboard inside the Expo app. The real version should:
//    • Use React Native primitives (View / Text / Pressable / etc.)
//    • Pull every value from `tokens.ts` instead of inline literals
//    • Read live data from Supabase via the views (v_account_summary,
//      v_net_worth_history, v_monthly_cashflow, etc.)
//    • Use Victory Native XL instead of Recharts
//    • Use TanStack Query for the data fetching
//
//  What to faithfully match:
//    • The hero toggle (Wealth ⇄ Debt) and how it changes the chart
//    • The big mono-font number that updates as the user scrubs the chart
//    • Color coding: debt = red, cash = green, investment = gold
//    • Highest-APR debt gets a gold border + flame icon
//    • The 3-step Add Account bottom sheet (bucket → type → form)
//    • The Delphi's Wisdom + Ask Delphi + monthly reminder cards
//    • Dark-first, with full light-mode support
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Bell, Plus, Sparkles, ChevronRight, Sun, Moon, CreditCard, Wallet,
  LineChart as LineIcon, ArrowUpRight, ArrowDownRight, Flame, X,
  Building2, Banknote, PiggyBank, Home as HomeIcon, Car, Briefcase, Check
} from 'lucide-react';

const STYLES = `
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes pulseGreen { 0%,100% { box-shadow: 0 0 0 0 rgba(0,217,100,0.5); } 50% { box-shadow: 0 0 0 10px rgba(0,217,100,0); } }
  .delphi-float { animation: float 3.5s ease-in-out infinite; }
  .fade-in { animation: fadeIn 0.4s ease-out both; }
  .slide-up { animation: slideUp 0.32s cubic-bezier(.2,.8,.2,1); }
  .num { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: -0.02em; }
  .ds { font-family: ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .pulse-green { animation: pulseGreen 2.4s ease-out infinite; }
  ::-webkit-scrollbar { display: none; }
`;

// Placeholder Delphi avatar — V1 geometric face. Replaced later with commissioned art.
function Delphi({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <ellipse cx="50" cy="55" rx="34" ry="30" fill="#0F0F0F" />
      <polygon points="20,38 26,16 38,32" fill="#0F0F0F" />
      <polygon points="62,32 74,16 80,38" fill="#0F0F0F" />
      <polygon points="25,32 28,21 33,31" fill="#FF8FA8" />
      <polygon points="67,31 72,21 75,32" fill="#FF8FA8" />
      <path d="M 30 58 Q 26 80 50 82 Q 74 80 70 58 Q 60 56 50 63 Q 40 56 30 58 Z" fill="#FFFFFF" />
      <ellipse cx="40" cy="52" rx="4.6" ry="5.6" fill="#00E875" />
      <ellipse cx="60" cy="52" rx="4.6" ry="5.6" fill="#00E875" />
      <ellipse cx="40" cy="52" rx="1.2" ry="4.5" fill="#050505" />
      <ellipse cx="60" cy="52" rx="1.2" ry="4.5" fill="#050505" />
      <circle cx="41.6" cy="50.4" r="0.9" fill="#FFFFFF" />
      <circle cx="61.6" cy="50.4" r="0.9" fill="#FFFFFF" />
      <path d="M 47 64 L 53 64 L 50 68 Z" fill="#FF8FA8" />
      <path d="M 50 68 Q 50 72 46 72" stroke="#0F0F0F" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M 50 68 Q 50 72 54 72" stroke="#0F0F0F" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <g stroke="#0F0F0F" strokeWidth="0.55" strokeLinecap="round">
        <line x1="34" y1="66" x2="20" y2="64" /><line x1="34" y1="69" x2="20" y2="70" />
        <line x1="66" y1="66" x2="80" y2="64" /><line x1="66" y1="69" x2="80" y2="70" />
      </g>
    </svg>
  );
}

const generateSeries = (range, mode) => {
  const points = { '1W': 8, '1M': 30, '3M': 90, '6M': 120, '1Y': 180, 'ALL': 240 }[range];
  const start = mode === 'wealth' ? 18000 : 12000;
  const end = mode === 'wealth' ? 24318 : 8040;
  const out = [];
  for (let i = 0; i < points; i++) {
    const p = i / (points - 1);
    const t = start + (end - start) * p;
    const noise = (Math.sin(i * 0.7) + (Math.random() - 0.5)) * (mode === 'wealth' ? 600 : 350);
    out.push({ x: i, value: Math.max(0, t + noise) });
  }
  return out;
};

const debtAccounts = [
  { id: 1, name: 'Chase Sapphire', sub: '••4521', balance: 4280.12, apr: 24.99, payment: 145, due: 'Nov 15' },
  { id: 2, name: 'Capital One',   sub: '••7733', balance: 1620.00, apr: 22.49, payment:  65, due: 'Nov 8'  },
  { id: 3, name: 'Amex Gold',     sub: '••1009', balance: 2140.50, apr: 19.99, payment:  80, due: 'Nov 22' },
];
const cashAccounts = [
  { id: 1, name: 'Chase Checking', sub: '••2208',     balance:  3450.22, apy: null, trend: 'up'   },
  { id: 2, name: 'Ally Savings',   sub: 'High Yield', balance: 12840.00, apy: 4.20, trend: 'up'   },
  { id: 3, name: 'Emergency Fund', sub: 'Marcus',     balance:  5200.00, apy: 4.10, trend: 'flat' },
];
const investAccounts = [
  { id: 1, name: 'Fidelity 401k', sub: 'Employer match', balance: 42180.00, ytd: 12.4 },
  { id: 2, name: 'Roth IRA',      sub: 'Vanguard',       balance: 18920.00, ytd:  8.9 },
  { id: 3, name: 'Robinhood',     sub: 'Brokerage',      balance:  4250.00, ytd: 22.1 },
];

const quotes = [
  "Every payment is a brick in the wall between you and tomorrow's worry.",
  "Compound interest works overtime — yours or theirs. Pick a side.",
  "The debt doesn't shrink when you ignore it. It shrinks when you face it.",
  "Your future self is watching what you do today.",
  "Money isn't morality. It's just math. The math is on your side now.",
];

export default function MoneyDashboard() {
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [mode, setMode] = useState('wealth');
  const [timeRange, setTimeRange] = useState('1M');
  const [tab, setTab] = useState('debt');
  const [hoverVal, setHoverVal] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * quotes.length));

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const T = {
    bg:        isDark ? '#0A0A0A' : '#F6F7F4',
    bgSoft:    isDark ? '#0F0F0F' : '#EFF1ED',
    card:      isDark ? '#141414' : '#FFFFFF',
    cardSoft:  isDark ? '#1A1A1A' : '#FAFBF8',
    border:    isDark ? '#1F1F1F' : '#E5E7E3',
    text:      isDark ? '#FFFFFF' : '#0A0A0A',
    textMuted: isDark ? '#9A9A9A' : '#6B6B6B',
    textDim:   isDark ? '#5A5A5A' : '#9C9C9C',
    green:     '#00D964',
    greenBright:'#00E875',
    gold:      '#ECC97D',
    goldSoft:  '#E8C77E',
    red:       '#FF4747',
  };

  const chartData = useMemo(() => generateSeries(timeRange, mode), [timeRange, mode]);
  const finalVal  = chartData[chartData.length - 1].value;
  const startVal  = chartData[0].value;
  const displayVal = hoverVal ?? finalVal;
  const delta = mode === 'wealth' ? (finalVal - startVal) : (startVal - finalVal);
  const deltaPct = (delta / startVal) * 100;
  const isGood = delta >= 0;
  const accentColor = mode === 'wealth' ? T.green : T.red;
  const goodColor = isGood ? T.green : T.red;

  const accounts = tab === 'debt' ? debtAccounts : tab === 'cash' ? cashAccounts : investAccounts;
  const totalDebt   = debtAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCash   = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const totalInvest = investAccounts.reduce((s, a) => s + a.balance, 0);

  if (loading) {
    return (
      <div className="ds" style={{
        minHeight: '100vh', background: T.bg, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18
      }}>
        <style>{STYLES}</style>
        <div className="delphi-float"><Delphi size={96} /></div>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Delphi</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: 999, background: T.green,
              opacity: 0.3, animation: `float 1s ease-in-out ${i * 0.2}s infinite`
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ds" style={{ background: T.bg, color: T.text, minHeight: '100vh' }}>
      <style>{STYLES}</style>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 18px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: T.cardSoft,
              border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Delphi size={28} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4 }}>Delphi</div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: -2 }}>Good evening, Trev</div>
            </div>
          </div>
          <button onClick={() => setIsDark(!isDark)} style={{
            background: T.card, border: `1px solid ${T.border}`, width: 36, height: 36,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            {isDark ? <Sun size={15} color={T.gold} /> : <Moon size={15} color={T.text} />}
          </button>
        </div>

        {/* Wealth/Debt mode toggle */}
        <div style={{
          display: 'flex', background: T.cardSoft, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 4, marginBottom: 18
        }}>
          {['wealth', 'debt'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: mode === m ? T.card : 'transparent',
              color: mode === m ? T.text : T.textMuted,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.2, textTransform: 'uppercase',
              boxShadow: mode === m ? `0 2px 6px rgba(0,0,0,0.2)` : 'none',
              transition: 'all 0.2s'
            }}>
              {m === 'wealth' ? 'Wealth' : 'Debt'}
            </button>
          ))}
        </div>

        {/* Hero number — updates with chart hover */}
        <div className="fade-in" key={mode + timeRange + (hoverVal ? 'h' : 's')} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
            {mode === 'wealth' ? 'Net Position' : 'Total Debt'}
          </div>
          <div className="num" style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1 }}>
            ${displayVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ color: goodColor, fontSize: 13, fontWeight: 700 }} className="num">
              {isGood ? '+' : ''}{Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ color: goodColor, fontSize: 13, fontWeight: 600 }} className="num">
              ({isGood ? '+' : '−'}{Math.abs(deltaPct).toFixed(2)}%)
            </span>
            <span style={{ color: T.textDim, fontSize: 12 }}>{timeRange === '1W' ? 'this week' : timeRange === '1M' ? 'this month' : `past ${timeRange}`}</span>
          </div>
        </div>

        {/* Chart */}
        <div style={{ height: 160, margin: '4px -18px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 18, left: 18, bottom: 0 }}
              onMouseMove={(s) => {
                if (s?.isTooltipActive && s.activePayload?.length) {
                  setHoverVal(s.activePayload[0].payload.value);
                }
              }}
              onMouseLeave={() => setHoverVal(null)}
            >
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={() => null} cursor={{ stroke: T.textDim, strokeDasharray: '3 3', strokeWidth: 1 }} />
              <Area
                type="monotone" dataKey="value"
                stroke={accentColor} strokeWidth={2.2}
                fill="url(#grad)"
                activeDot={{ r: 5, fill: accentColor, stroke: T.bg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Time range pills */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between', marginBottom: 22 }}>
          {['1W', '1M', '3M', '6M', '1Y', 'ALL'].map(r => (
            <button key={r} onClick={() => setTimeRange(r)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: timeRange === r ? `${accentColor}20` : 'transparent',
              color: timeRange === r ? accentColor : T.textMuted,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4
            }}>{r}</button>
          ))}
        </div>

        {/* Bucket totals — tap to switch list below */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { k: 'debt',   label: 'Debt',     val: totalDebt,   color: T.red,   icon: <CreditCard size={12} /> },
            { k: 'cash',   label: 'Cash',     val: totalCash,   color: T.green, icon: <Wallet size={12} /> },
            { k: 'invest', label: 'Invest',   val: totalInvest, color: T.gold,  icon: <LineIcon size={12} /> },
          ].map(b => (
            <button key={b.k} onClick={() => setTab(b.k)} style={{
              background: tab === b.k ? T.card : T.cardSoft,
              border: `1px solid ${tab === b.k ? b.color + '50' : T.border}`,
              borderRadius: 12, padding: '10px 10px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.18s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: b.color, marginBottom: 4 }}>
                {b.icon}
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{b.label}</span>
              </div>
              <div className="num" style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                ${(b.val / 1000).toFixed(1)}k
              </div>
            </button>
          ))}
        </div>

        {/* Account list — color-coded, highest-APR debt gets gold border + flame */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {accounts.map((a, i) => {
            const isHottest = tab === 'debt' && i === 0;
            const dotColor = tab === 'debt' ? T.red : tab === 'cash' ? T.green : T.gold;
            return (
              <div key={a.id} className="fade-in" style={{
                background: T.card, border: `1px solid ${isHottest ? T.gold + '55' : T.border}`,
                borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', animationDelay: `${i * 0.05}s`
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: `${dotColor}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {tab === 'debt'   ? <CreditCard size={17} color={dotColor} /> :
                   tab === 'cash'   ? <Wallet     size={17} color={dotColor} /> :
                                      <LineIcon   size={17} color={dotColor} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</span>
                    {isHottest && <Flame size={11} color={T.gold} />}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {a.sub}
                    {tab === 'debt' && ` · ${a.apr}% APR`}
                    {tab === 'cash' && a.apy && ` · ${a.apy}% APY`}
                    {tab === 'invest' && ` · ${a.ytd >= 0 ? '+' : ''}${a.ytd}% YTD`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: 14, fontWeight: 700 }}>
                    ${a.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                    {tab === 'debt' ? `Due ${a.due}` :
                     tab === 'cash' ? (a.trend === 'up' ? '↑ growing' : 'stable') :
                     '↑ this year'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delphi's Wisdom */}
        <div style={{
          background: `linear-gradient(135deg, ${T.gold}12, ${T.gold}05)`,
          border: `1px solid ${T.gold}35`,
          borderRadius: 16, padding: 16, marginBottom: 12, position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.08 }}>
            <Delphi size={80} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={12} color={T.gold} />
            <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Delphi's Wisdom
            </span>
          </div>
          <p style={{
            fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.5, margin: 0,
            color: T.text, fontWeight: 500, position: 'relative', zIndex: 1
          }}>
            "{quotes[quoteIdx]}"
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8, marginBottom: 0 }}>— Delphi</p>
        </div>

        {/* Ask Delphi CTA — Phase 2, but visible as "coming soon" placeholder in MVP */}
        <button style={{
          width: '100%', background: T.card, border: `1px solid ${T.gold}50`,
          borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', color: T.text, marginBottom: 10,
          boxShadow: `0 0 0 1px ${T.gold}10, 0 8px 24px ${T.gold}15`
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: `${T.gold}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={17} color={T.gold} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>Ask Delphi</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>A read on your money, on demand</div>
          </div>
          <ChevronRight size={16} color={T.textMuted} />
        </button>

        {/* Reminder banner */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 12, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: `${T.green}1F`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Bell size={13} color={T.green} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Monthly check-in</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>Next reminder · Dec 1</div>
          </div>
          <ChevronRight size={14} color={T.textMuted} />
        </div>
      </div>

      {/* Floating action button — opens Add Account sheet */}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <button onClick={() => setAddOpen(true)} className="pulse-green" style={{
          background: T.green, width: 56, height: 56, borderRadius: 999, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 24px ${T.green}55, 0 0 0 6px ${T.bg}`
        }}>
          <Plus size={24} color="#0A0A0A" strokeWidth={2.6} />
        </button>
      </div>

      {addOpen && <AddAccountSheet T={T} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// 3-step Add Account flow: bucket → type → form → confirmation
function AddAccountSheet({ T, onClose }) {
  const [bucket, setBucket] = useState(null);
  const [type, setType] = useState(null);
  const [form, setForm] = useState({ name: '', balance: '', apr: '', payment: '' });
  const [saved, setSaved] = useState(false);

  const types = {
    debt:   [{ k: 'card',     label: 'Credit Card', icon: <CreditCard size={18} /> },
             { k: 'loan',     label: 'Personal Loan', icon: <Banknote size={18} /> },
             { k: 'mortgage', label: 'Mortgage', icon: <HomeIcon size={18} /> },
             { k: 'auto',     label: 'Auto Loan', icon: <Car size={18} /> }],
    cash:   [{ k: 'check',    label: 'Checking', icon: <Wallet size={18} /> },
             { k: 'savings',  label: 'Savings', icon: <PiggyBank size={18} /> },
             { k: 'hysa',     label: 'High-Yield Savings', icon: <Building2 size={18} /> }],
    invest: [{ k: '401k',     label: '401(k)', icon: <Briefcase size={18} /> },
             { k: 'ira',      label: 'IRA / Roth IRA', icon: <PiggyBank size={18} /> },
             { k: 'broker',   label: 'Brokerage', icon: <LineIcon size={18} /> }],
  };
  const bucketColor = bucket === 'debt' ? T.red : bucket === 'cash' ? T.green : T.gold;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20,
        animation: 'fadeIn 0.2s ease-out'
      }} />
      <div className="ds slide-up" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 21,
        background: T.bg, borderTop: `1px solid ${T.border}`,
        borderRadius: '20px 20px 0 0',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 -20px 40px rgba(0,0,0,0.4)'
      }}>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '14px 18px 32px' }}>
          <div style={{ width: 36, height: 4, background: T.border, borderRadius: 999, margin: '0 auto 14px' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, color: T.text }}>
                {!bucket ? 'Add an account' : !type ? 'Pick a type' : saved ? 'Added' : 'Account details'}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                {!bucket ? 'What kind of money is this?' :
                 !type ? `In ${bucket === 'debt' ? 'debts' : bucket === 'cash' ? 'cash' : 'investments'}` :
                 saved ? 'Delphi will track it from here.' : 'Just the basics. You can edit later.'}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: T.card, border: `1px solid ${T.border}`, width: 32, height: 32, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <X size={14} color={T.text} />
            </button>
          </div>

          {!bucket && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { k: 'debt',   label: 'Debt',         desc: 'Credit cards, loans, mortgage', color: T.red,   icon: <CreditCard size={20} /> },
                { k: 'cash',   label: 'Cash',         desc: 'Checking, savings, HYSA',       color: T.green, icon: <Wallet size={20} /> },
                { k: 'invest', label: 'Investments',  desc: '401(k), IRA, brokerage',        color: T.gold,  icon: <LineIcon size={20} /> },
              ].map(b => (
                <button key={b.k} onClick={() => setBucket(b.k)} style={{
                  width: '100%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                  padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                  color: T.text
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: `${b.color}1F`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: b.color
                  }}>{b.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{b.desc}</div>
                  </div>
                  <ChevronRight size={16} color={T.textMuted} />
                </button>
              ))}
            </div>
          )}

          {bucket && !type && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {types[bucket].map(t => (
                <button key={t.k} onClick={() => setType(t.k)} style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                  padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-start', gap: 10, color: T.text, textAlign: 'left'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: `${bucketColor}1F`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: bucketColor
                  }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                </button>
              ))}
            </div>
          )}

          {bucket && type && !saved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field T={T} label="Account name" placeholder="e.g. Chase Sapphire"
                value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <Field T={T} label="Current balance" placeholder="0.00" prefix="$"
                value={form.balance} onChange={v => setForm({ ...form, balance: v })} />
              {bucket === 'debt' && (
                <>
                  <Field T={T} label="Interest rate" placeholder="0.00" suffix="% APR"
                    value={form.apr} onChange={v => setForm({ ...form, apr: v })} />
                  <Field T={T} label="Minimum payment" placeholder="0.00" prefix="$"
                    value={form.payment} onChange={v => setForm({ ...form, payment: v })} />
                </>
              )}
              {bucket === 'cash' && (
                <Field T={T} label="APY (optional)" placeholder="0.00" suffix="%"
                  value={form.apr} onChange={v => setForm({ ...form, apr: v })} />
              )}
              <button onClick={() => setSaved(true)} disabled={!form.name || !form.balance} style={{
                marginTop: 8, width: '100%', padding: 14, borderRadius: 12, border: 'none',
                background: form.name && form.balance ? T.green : T.cardSoft,
                color: form.name && form.balance ? '#0A0A0A' : T.textMuted,
                fontSize: 14, fontWeight: 800, letterSpacing: 0.3, cursor: form.name && form.balance ? 'pointer' : 'default'
              }}>
                Save account
              </button>
            </div>
          )}

          {saved && (
            <div className="fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 999, background: `${T.green}20`,
                margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Check size={32} color={T.green} strokeWidth={3} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{form.name} added</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 22 }}>
                Delphi will check in with you on the 1st of every month.
              </div>
              <button onClick={onClose} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none',
                background: T.green, color: '#0A0A0A', fontSize: 14, fontWeight: 800, cursor: 'pointer'
              }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ T, label, value, onChange, placeholder, prefix, suffix }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 11,
        padding: '0 12px'
      }}>
        {prefix && <span style={{ color: T.textMuted, fontSize: 14, marginRight: 4 }}>{prefix}</span>}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="num"
          style={{
            flex: 1, padding: '12px 0', background: 'transparent', border: 'none', outline: 'none',
            fontSize: 15, fontWeight: 600, color: T.text
          }}
        />
        {suffix && <span style={{ color: T.textMuted, fontSize: 12, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </label>
  );
}
