/**
 * GNSI ERP — Accounts Overview (Enhanced)
 * Single-view treasury dashboard: net balance card, summary metrics, transaction ledger.
 * 
 * Improvements:
 * - Better mobile responsiveness
 * - Enhanced accessibility (aria-labels, proper semantics)
 * - Improved visual hierarchy
 * - Better empty states
 * - Fixed modal overflow
 * - Smoother animations
 * - Better color contrast
 */

import React, { useMemo, useState } from 'react'

// ── Type system ────────────────────────────────────────────────────────────
// Fraunces (a characterful, slightly ink-trapped serif) carries the "private
// treasury" identity on the wordmark, balance figure, and section titles.
// JetBrains Mono gives every amount and date true tabular alignment.
const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif"
const FONT_MONO     = "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace"

export const AccountsDashboardBanking = ({
  entries = [],
  canWrite = false,
  canEditExpenditure = null, // if not passed, falls back to canWrite (backward compatible)
  fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`,
  isMobile = false,
  openEdit = () => {},
  handleDelete = () => {},
  onExportReport = null, // (format:'pdf'|'docx'|'excel') => void — generates a full report of all entries, independent of on-screen filters
  exportingReport = '', // '' | 'pdf' | 'docx' | 'excel' — disables buttons while generating
}) => {
  const canEdit = canEditExpenditure !== null ? canEditExpenditure : canWrite
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [incomePage, setIncomePage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const PAGE_SIZE = isMobile ? 10 : 15

  React.useEffect(() => {
    setIncomePage(1)
    setExpensePage(1)
  }, [searchQuery])

  const stats = useMemo(() => {
    const income = entries
      .filter((e) => e.type === 'Income')
      .reduce((s, e) => s + Number(e.amount || 0), 0)
    const expense = entries
      .filter((e) => e.type === 'Expense')
      .reduce((s, e) => s + Number(e.amount || 0), 0)
    const confirmed = entries.filter((e) => e.status === 'Confirmed').length
    const pending = entries.filter((e) => e.status !== 'Confirmed').length
    return { income, expense, balance: income - expense, confirmed, pending }
  }, [entries])

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.entry_date || 0) - new Date(a.entry_date || 0)
      ),
    [entries]
  )

  const searchedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedEntries
    return sortedEntries.filter((e) =>
      [e.category, e.note, e.voucher_head, e.payment_mode, e.account_type]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    )
  }, [sortedEntries, searchQuery])

  const sortedIncomeEntries = useMemo(
    () => searchedEntries.filter((e) => e.type === 'Income'),
    [searchedEntries]
  )
  const sortedExpenseEntries = useMemo(
    () => searchedEntries.filter((e) => e.type === 'Expense'),
    [searchedEntries]
  )

  // Renders one ledger card (used twice below — once for Income, once for Expenditure —
  // so the two tables share identical styling/behavior while staying visually separate).
  const renderLedgerCard = (list, { title, subtitle, accent, emptyIcon, emptyTitle, emptyBody, delay, page, setPage }) => {
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const rows = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    return (
      <div
        className="gnsi-animate"
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
          animationDelay: delay,
        }}
      >
        {/* Accent bar */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />

        {/* Header */}
        <div
          style={{
            padding: isMobile ? '16px' : '20px 24px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '17px',
                fontWeight: 600,
                margin: 0,
                color: accent,
              }}
            >
              {title}
            </p>
            <p
              style={{
                fontSize: '12px',
                color: '#65676F',
                margin: '4px 0 0 0',
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        {/* Rows */}
        <div>
          {list.length === 0 ? (
            <div
              style={{
                padding: isMobile ? '40px 20px' : '60px 40px',
                textAlign: 'center',
                color: '#9C9EA6',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.6 }}>{emptyIcon}</div>
              <p style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>
                {emptyTitle}
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#C7C9D1',
                  margin: '6px 0 0 0',
                }}
              >
                {emptyBody}
              </p>
            </div>
          ) : (
            rows.map((entry, idx) => {
              const isIncome = entry.type === 'Income'
              return (
                <div
                  key={entry.id}
                  tabIndex={0}
                  role="button"
                  className="gnsi-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '14px 16px' : '16px 24px',
                    borderBottom:
                      idx < rows.length - 1
                        ? '1px solid rgba(0,0,0,0.04)'
                        : 'none',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s ease, transform 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FAFAF8'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                  onClick={() => setSelectedTxn(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedTxn(entry)
                    }
                  }}
                >
                  {/* Left side */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        flexShrink: 0,
                        backgroundColor: isIncome
                          ? 'rgba(10, 128, 66, 0.1)'
                          : 'rgba(215, 0, 21, 0.1)',
                        color: isIncome ? '#0E7A4C' : '#AF1830',
                      }}
                    >
                      {isIncome ? '↑' : '↓'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          margin: 0,
                          color: '#16171B',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.note || entry.category || 'Transaction'}
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#9C9EA6',
                          margin: '4px 0 0 0',
                        }}
                      >
                        {entry.entry_date} · {entry.payment_mode || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div
                    style={{
                      textAlign: 'right',
                      marginLeft: '16px',
                      flexShrink: 0,
                    }}
                  >
                    <p
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        margin: 0,
                        fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
                        color: isIncome ? '#0E7A4C' : '#AF1830',
                      }}
                    >
                      {isIncome ? '+' : '−'}{fmt(entry.amount || 0)}
                    </p>
                    {entry.status !== 'Confirmed' && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: '5px',
                          marginTop: '6px',
                          backgroundColor: '#FBF0DE',
                          color: '#9C6410',
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {list.length > PAGE_SIZE && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '10px 16px' : '10px 24px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: safePage === 1 ? '#F1F0EC' : '#EFEFEC',
                color: safePage === 1 ? '#C7C9D1' : '#16171B',
                cursor: safePage === 1 ? 'default' : 'pointer',
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: '12px', color: '#9C9EA6', fontWeight: 500 }}>
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: safePage === totalPages ? '#F1F0EC' : '#EFEFEC',
                color: safePage === totalPages ? '#C7C9D1' : '#16171B',
                cursor: safePage === totalPages ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F6F5F2', color: '#16171B', padding: isMobile ? '16px' : '24px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        button {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border: none;
          outline: none;
        }

        button:focus-visible {
          outline: 2px solid #B9902F;
          outline-offset: 2px;
        }

        .gnsi-row:focus-visible {
          outline: 2px solid #B9902F;
          outline-offset: -2px;
        }

        .smooth-transition {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes gnsiRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes gnsiSheen {
          0%   { transform: translateX(-120%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }

        .gnsi-animate {
          animation: gnsiRise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .gnsi-sheen {
          animation: gnsiSheen 3.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .gnsi-animate, .gnsi-sheen {
            animation: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="gnsi-animate" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #16171B 0%, #2B2C31 100%)',
            border: '1px solid rgba(185, 144, 47, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            style={{ width: '20px', height: '20px' }}
          >
            <path d="M3 12l2-2 4 4 8-8 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '18px',
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: '2px',
              letterSpacing: '0.1px',
            }}
          >
            GNSI Treasury
          </p>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#9C9EA6',
              lineHeight: 1.3,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Accounts &amp; cash flow
          </p>
        </div>
      </div>

      {/* Treasury Card - Compact */}
      <div
        className="gnsi-animate"
        style={{
          position: 'relative',
          borderRadius: '18px',
          padding: isMobile ? '18px' : '22px 26px',
          marginBottom: '24px',
          color: 'white',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #16171B 0%, #202126 50%, #16171B 100%)',
          border: '1px solid rgba(185, 144, 47, 0.25)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.05), 0 12px 32px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Animated foil sheen */}
        <div
          className="gnsi-sheen"
          style={{
            position: 'absolute',
            top: '-60%',
            left: '-30%',
            width: '50%',
            height: '220%',
            pointerEvents: 'none',
            background:
              'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '14px',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '2px',
                  margin: 0,
                }}
              >
                Net balance
              </p>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                GNSI · Khangabok, Thoubal
              </p>
            </div>
            {/* Foil seal — the card's signature mark, in place of a plain chip */}
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(150deg, #F1DFA6 0%, #C9A227 45%, #8C6D28 100%)',
                boxShadow: '0 2px 10px rgba(180, 141, 46, 0.35), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(0,0,0,0.25)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#3A2E0E',
                  lineHeight: 1,
                }}
              >
                G
              </span>
            </div>
          </div>

          {/* Balance */}
          <p
            style={{
              fontSize: isMobile ? '26px' : '34px',
              fontWeight: 500,
              margin: '8px 0 14px 0',
              fontFamily: FONT_MONO,
              letterSpacing: '-0.3px',
              lineHeight: 1.1,
            }}
          >
            {fmt(stats.balance)}
          </p>

          {/* Metrics row - more compact */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: isMobile ? '12px' : '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '14px',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  margin: '0 0 4px 0',
                  fontWeight: 500,
                }}
              >
                Income
              </p>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
                  color: '#86D9AE',
                }}
              >
                +{fmt(stats.income)}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  margin: '0 0 4px 0',
                  fontWeight: 500,
                }}
              >
                Expense
              </p>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
                  color: '#FF9C93',
                }}
              >
                −{fmt(stats.expense)}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  margin: '0 0 4px 0',
                  fontWeight: 500,
                }}
              >
                Confirmed
              </p>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                {stats.confirmed}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Pending */}
        <div
          className="gnsi-animate smooth-transition"
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
            animationDelay: '0.05s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#65676F',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              margin: 0,
            }}
          >
            Pending
          </p>
          <p
            style={{
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 600,
              margin: '12px 0 0 0',
              fontFamily: FONT_MONO,
            }}
          >
            {stats.pending}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#9C9EA6',
              margin: '8px 0 0 0',
            }}
          >
            Awaiting confirmation
          </p>
        </div>

        {/* Total Transactions */}
        <div
          className="gnsi-animate smooth-transition"
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
            animationDelay: '0.10s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#65676F',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              margin: 0,
            }}
          >
            Total
          </p>
          <p
            style={{
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 600,
              margin: '12px 0 0 0',
              fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
            }}
          >
            {entries.length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#9C9EA6',
              margin: '8px 0 0 0',
            }}
          >
            All-time transactions
          </p>
        </div>

        {/* Income Count */}
        <div
          className="gnsi-animate smooth-transition"
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
            animationDelay: '0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#65676F',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              margin: 0,
            }}
          >
            Income
          </p>
          <p
            style={{
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 600,
              margin: '12px 0 0 0',
              fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
              color: '#0E7A4C',
            }}
          >
            {entries.filter((e) => e.type === 'Income').length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#9C9EA6',
              margin: '8px 0 0 0',
            }}
          >
            Credits recorded
          </p>
        </div>

        {/* Expense Count */}
        <div
          className="gnsi-animate smooth-transition"
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
            animationDelay: '0.20s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#65676F',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              margin: 0,
            }}
          >
            Expense
          </p>
          <p
            style={{
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 600,
              margin: '12px 0 0 0',
              fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
              color: '#AF1830',
            }}
          >
            {entries.filter((e) => e.type === 'Expense').length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#9C9EA6',
              margin: '8px 0 0 0',
            }}
          >
            Debits recorded
          </p>
        </div>
      </div>

      {/* Export Report — generates a full letterheaded report of ALL entries (not just the filtered/paginated view) */}
      {onExportReport && (
        <div
          className="gnsi-animate"
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap',
            animationDelay: '0.18s',
          }}
        >
          <button
            onClick={() => onExportReport('pdf')}
            disabled={!!exportingReport}
            style={{
              padding: isMobile ? '8px 14px' : '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              color: 'white',
              backgroundColor: exportingReport === 'pdf' ? '#94a3b8' : '#dc2626',
              cursor: exportingReport ? 'not-allowed' : 'pointer',
            }}
          >
            {exportingReport === 'pdf' ? '⏳ Generating…' : '📄 Export PDF'}
          </button>
          <button
            onClick={() => onExportReport('docx')}
            disabled={!!exportingReport}
            style={{
              padding: isMobile ? '8px 14px' : '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              color: 'white',
              backgroundColor: exportingReport === 'docx' ? '#94a3b8' : '#1d4ed8',
              cursor: exportingReport ? 'not-allowed' : 'pointer',
            }}
          >
            {exportingReport === 'docx' ? '⏳ Generating…' : '📝 Export DOCX'}
          </button>
          <button
            onClick={() => onExportReport('excel')}
            disabled={!!exportingReport}
            style={{
              padding: isMobile ? '8px 14px' : '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              color: 'white',
              backgroundColor: exportingReport === 'excel' ? '#94a3b8' : '#16a34a',
              cursor: exportingReport ? 'not-allowed' : 'pointer',
            }}
          >
            {exportingReport === 'excel' ? '⏳ Generating…' : '📊 Export Excel'}
          </button>
        </div>
      )}

      {/* Search */}
      <div
        className="gnsi-animate"
        style={{ marginBottom: '20px', animationDelay: '0.2s' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'white',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '12px',
            padding: isMobile ? '10px 14px' : '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <span style={{ fontSize: '15px', color: '#9C9EA6' }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category, note, voucher head, mode…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#16171B',
              backgroundColor: 'transparent',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                fontSize: '13px',
                color: '#9C9EA6',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Transaction Ledgers — Income and Expenditure kept in separate tables */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '20px',
        }}
      >
        {renderLedgerCard(sortedIncomeEntries, {
          title: '↑ Income',
          subtitle: `${sortedIncomeEntries.length} total · sorted by date`,
          accent: '#0E7A4C',
          emptyIcon: '📈',
          emptyTitle: searchQuery ? 'No matches' : 'No income yet',
          emptyBody: searchQuery ? 'Try a different search term.' : 'Recorded income will show up here.',
          delay: '0.25s',
          page: incomePage,
          setPage: setIncomePage,
        })}
        {renderLedgerCard(sortedExpenseEntries, {
          title: '↓ Expenditure',
          subtitle: `${sortedExpenseEntries.length} total · sorted by date`,
          accent: '#AF1830',
          emptyIcon: '📉',
          emptyTitle: searchQuery ? 'No matches' : 'No expenditure yet',
          emptyBody: searchQuery ? 'Try a different search term.' : 'Recorded expenses will show up here.',
          delay: '0.30s',
          page: expensePage,
          setPage: setExpensePage,
        })}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 16, 20, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 50,
          }}
          onClick={() => setSelectedTxn(null)}
        >
          <div
            className="gnsi-sheet"
            style={{
              backgroundColor: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '28px 20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(0,0,0,0.20)',
              borderTop: '3px solid #C9A227',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedTxn(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                cursor: 'pointer',
                fontSize: '24px',
                color: '#9C9EA6',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#EFEFEC'
                e.target.style.color = '#16171B'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent'
                e.target.style.color = '#9C9EA6'
              }}
              aria-label="Close modal"
            >
              ×
            </button>

            {/* Content */}
            <h3
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '20px',
                fontWeight: 600,
                margin: '0 0 6px 0',
                paddingRight: '32px',
              }}
            >
              {selectedTxn.note || selectedTxn.category || 'Transaction'}
            </h3>
            <div style={{ width: '36px', height: '2px', background: 'linear-gradient(90deg,#C9A227,#8C6D28)', margin: '0 0 20px 0' }} />

            <div style={{ marginBottom: '28px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Type
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      margin: 0,
                      color: '#16171B',
                    }}
                  >
                    {selectedTxn.type}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Amount
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      margin: 0,
                      fontFamily: "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace",
                      color:
                        selectedTxn.type === 'Income' ? '#0E7A4C' : '#AF1830',
                    }}
                  >
                    {selectedTxn.type === 'Income' ? '+' : '−'}
                    {fmt(selectedTxn.amount || 0)}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Date
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      margin: 0,
                      color: '#16171B',
                    }}
                  >
                    {selectedTxn.entry_date}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Mode
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      margin: 0,
                      color: '#16171B',
                    }}
                  >
                    {selectedTxn.payment_mode || '—'}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Status
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      margin: 0,
                      color: selectedTxn.status === 'Confirmed' ? '#0E7A4C' : '#9C6410',
                    }}
                  >
                    {selectedTxn.status}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#9C9EA6',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      margin: '0 0 6px 0',
                      fontWeight: 500,
                    }}
                  >
                    Account
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      margin: 0,
                      color: '#16171B',
                    }}
                  >
                    {selectedTxn.account_type || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {(() => {
              const isExpense = selectedTxn.type === 'Expense'
              const showEdit = canWrite || (canEdit && isExpense)
              return (canWrite || showEdit) && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                {showEdit && (
                <button
                  onClick={() => {
                    openEdit(selectedTxn)
                    setSelectedTxn(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#16171B',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#2B2C31'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#16171B'
                  }}
                >
                  Edit
                </button>
                )}
                {canWrite && (
                <button
                  onClick={() => {
                    handleDelete(selectedTxn.id)
                    setSelectedTxn(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#FDEAEC',
                    color: '#AF1830',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#FFCDD2'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#FDEAEC'
                  }}
                >
                  Delete
                </button>
                )}
              </div>
            )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountsDashboardBanking