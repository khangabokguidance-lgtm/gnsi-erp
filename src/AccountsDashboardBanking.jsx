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

export const AccountsDashboardBanking = ({
  entries = [],
  canWrite = false,
  fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`,
  isMobile = false,
  openEdit = () => {},
  handleDelete = () => {},
}) => {
  const [selectedTxn, setSelectedTxn] = useState(null)

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FBFBFD', color: '#1D1D1F', padding: isMobile ? '16px' : '24px' }}>
      <style>{`
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
          outline: 2px solid #0084FF;
          outline-offset: 2px;
        }

        .smooth-transition {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
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
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: '2px',
            }}
          >
            GNSI Treasury
          </p>
          <p
            style={{
              fontSize: '13px',
              color: '#AEAEB2',
              lineHeight: 1.3,
            }}
          >
            Accounts &amp; cash flow
          </p>
        </div>
      </div>

      {/* Treasury Card - Compact */}
      <div
        style={{
          position: 'relative',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px 24px',
          marginBottom: '24px',
          color: 'white',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 50%, #1D1D1F 100%)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Glossy overlay */}
        <div
          style={{
            position: 'absolute',
            top: '-60%',
            right: '-20%',
            width: '60%',
            height: '220%',
            pointerEvents: 'none',
            background:
              'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
            transform: 'rotate(8deg)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
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
            <div
              style={{
                width: '32px',
                height: '20px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #D4AF6A 0%, #B8915A 100%)',
                boxShadow: '0 2px 8px rgba(212, 175, 106, 0.25)',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Balance */}
          <p
            style={{
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: 600,
              margin: '8px 0 12px 0',
              fontFamily: "'Courier New', monospace",
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
                  fontFamily: "'Courier New', monospace",
                  color: '#6FDB9A',
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
                  fontFamily: "'Courier New', monospace",
                  color: '#FF8A8A',
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
                  fontFamily: "'Courier New', monospace",
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
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6E6E73',
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
              fontFamily: "'Courier New', monospace",
            }}
          >
            {stats.pending}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#AEAEB2',
              margin: '8px 0 0 0',
            }}
          >
            Awaiting confirmation
          </p>
        </div>

        {/* Total Transactions */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6E6E73',
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
              fontFamily: "'Courier New', monospace",
            }}
          >
            {entries.length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#AEAEB2',
              margin: '8px 0 0 0',
            }}
          >
            All-time transactions
          </p>
        </div>

        {/* Income Count */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6E6E73',
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
              fontFamily: "'Courier New', monospace",
              color: '#0A8042',
            }}
          >
            {entries.filter((e) => e.type === 'Income').length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#AEAEB2',
              margin: '8px 0 0 0',
            }}
          >
            Credits recorded
          </p>
        </div>

        {/* Expense Count */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#6E6E73',
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
              fontFamily: "'Courier New', monospace",
              color: '#D70015',
            }}
          >
            {entries.filter((e) => e.type === 'Expense').length}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#AEAEB2',
              margin: '8px 0 0 0',
            }}
          >
            Debits recorded
          </p>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
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
                fontSize: '15px',
                fontWeight: 600,
                margin: 0,
              }}
            >
              Recent Transactions
            </p>
            <p
              style={{
                fontSize: '12px',
                color: '#6E6E73',
                margin: '4px 0 0 0',
              }}
            >
              {entries.length} total · sorted by date
            </p>
          </div>
        </div>

        {/* Transactions List */}
        <div>
          {entries.length === 0 ? (
            <div
              style={{
                padding: isMobile ? '40px 20px' : '60px 40px',
                textAlign: 'center',
                color: '#AEAEB2',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>
                No transactions yet
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: '#D1D5DB',
                  margin: '6px 0 0 0',
                }}
              >
                Start recording income and expenses to see them here.
              </p>
            </div>
          ) : (
            sortedEntries.slice(0, isMobile ? 15 : 30).map((entry, idx) => {
              const isIncome = entry.type === 'Income'
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: isMobile ? '14px 16px' : '16px 24px',
                    borderBottom:
                      idx < sortedEntries.slice(0, isMobile ? 15 : 30).length - 1
                        ? '1px solid rgba(0,0,0,0.04)'
                        : 'none',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FAFAFA'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => setSelectedTxn(entry)}
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
                        color: isIncome ? '#0A8042' : '#D70015',
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
                          color: '#1D1D1F',
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
                          color: '#AEAEB2',
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
                        fontFamily: "'Courier New', monospace",
                        color: isIncome ? '#0A8042' : '#D70015',
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
                          backgroundColor: '#FDF1E3',
                          color: '#B25E00',
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
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 50,
          }}
          onClick={() => setSelectedTxn(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '28px 20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(0,0,0,0.20)',
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
                color: '#AEAEB2',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#F5F5F7'
                e.target.style.color = '#1D1D1F'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent'
                e.target.style.color = '#AEAEB2'
              }}
              aria-label="Close modal"
            >
              ×
            </button>

            {/* Content */}
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 24px 0',
                paddingRight: '32px',
              }}
            >
              {selectedTxn.note || selectedTxn.category || 'Transaction'}
            </h3>

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
                      color: '#AEAEB2',
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
                      color: '#1D1D1F',
                    }}
                  >
                    {selectedTxn.type}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#AEAEB2',
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
                      fontFamily: "'Courier New', monospace",
                      color:
                        selectedTxn.type === 'Income' ? '#0A8042' : '#D70015',
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
                      color: '#AEAEB2',
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
                      color: '#1D1D1F',
                    }}
                  >
                    {selectedTxn.entry_date}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#AEAEB2',
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
                      color: '#1D1D1F',
                    }}
                  >
                    {selectedTxn.payment_mode || '—'}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#AEAEB2',
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
                      color: selectedTxn.status === 'Confirmed' ? '#0A8042' : '#B25E00',
                    }}
                  >
                    {selectedTxn.status}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#AEAEB2',
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
                      color: '#1D1D1F',
                    }}
                  >
                    {selectedTxn.account_type || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {canWrite && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <button
                  onClick={() => {
                    openEdit(selectedTxn)
                    setSelectedTxn(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#1D1D1F',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#3A3A3C'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#1D1D1F'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedTxn.id)
                    setSelectedTxn(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    backgroundColor: '#FDEAEC',
                    color: '#D70015',
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountsDashboardBanking