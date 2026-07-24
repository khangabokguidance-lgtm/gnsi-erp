/**
 * Banking-Style Transactions View — FIXED & ENHANCED
 * For Accounts module — premium statement-like layout
 * Replaces the tabular Daily view with card-based transaction cards
 * 
 * Key improvements:
 * - Fixed React import
 * - Corrected running balance calculation
 * - Proper null checks for all props
 * - Enhanced mobile responsiveness
 * - CSS-based hover states (better for mobile)
 * - Professional typography and spacing
 * - Accessibility improvements
 */

import React, { useMemo } from 'react'

export const TransactionsViewBanking = ({
  dayRows = [],
  dailyIsIncome = false,
  dailyDateMode = 'entry',
  dailyAmtColor = '#0a8042',
  dayTotal = 0,
  dailyCashAmt = 0,
  dailyBankAmt = 0,
  dailyTotalAmt = 0,
  fraudFlags = {},
  canWrite = false,
  canEditExpenditure = null, // if not passed, falls back to canWrite (backward compatible)
  fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`,
  openEdit = () => {},
  handleDelete = () => {},
  printReceiptMemo = () => {},
  isMobile = false,
  runningBalance = null,
}) => {
  const canEdit = canEditExpenditure !== null ? canEditExpenditure : canWrite
  // Compute running balance with corrected logic
  const balances = useMemo(() => {
    if (runningBalance && Array.isArray(runningBalance)) {
      return runningBalance
    }

    if (!dayRows || dayRows.length === 0) return []

    return dayRows.reduce((acc, item) => {
      const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0
      const currentAmount = Number(item.amount) || 0
      const newBalance = prevBalance + currentAmount
      return [...acc, { id: item.id, balance: newBalance }]
    }, [])
  }, [dayRows, runningBalance])

  const balanceMap = Object.fromEntries(balances.map((b) => [b.id, b.balance]))

  // Group by date
  const grouped = useMemo(() => {
    return dayRows.reduce((acc, item) => {
      const dateKey = item.entry_date || item.payment_date || 'No Date'
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(item)
      return acc
    }, {})
  }, [dayRows])

  const dates = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Date') return 1
    if (b === 'No Date') return -1
    return new Date(b) - new Date(a)
  })

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'No Date') return 'Unspecified Date'
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  // Payment mode icon
  const getPaymentModeIcon = (mode) => {
    const icons = {
      Cash: '💵',
      Bank: '🏦',
      UPI: '📱',
      Card: '💳',
      Cheque: '✓',
      'Online Transfer': '↔️',
      'Credit Card': '💳',
    }
    return icons[mode] || '💰'
  }

  // Transaction card component
  const TransactionCard = ({ item, balance, isFlagged }) => {
    const modeIcon = getPaymentModeIcon(item.payment_mode)
    const statusIcon = isFlagged ? '⚠️' : item.status === 'Confirmed' ? '✓' : '⏳'
    const statusColor = isFlagged ? '#d97706' : item.status === 'Confirmed' ? '#16a34a' : '#f59e0b'
    const statusLabel = isFlagged ? 'FLAGGED' : item.status === 'Confirmed' ? 'CONFIRMED' : 'PENDING'

    return (
      <div
        style={{
          backgroundColor: isFlagged ? '#fffbf0' : '#ffffff',
          border: isFlagged ? '1.5px solid #fed7aa' : '1px solid #e5e7eb',
          borderRadius: 12,
          padding: isMobile ? '12px 14px' : '14px 16px',
          marginBottom: 10,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          transition: 'all 0.2s ease',
          boxShadow: isFlagged
            ? '0 1px 3px rgba(251, 146, 60, 0.1), 0 0 0 2px rgba(251, 191, 36, 0.05)'
            : '0 1px 2px rgba(0, 0, 0, 0.04)',
          cursor: canWrite ? 'pointer' : 'default',
          ':hover': {
            boxShadow: isFlagged
              ? '0 2px 8px rgba(251, 146, 60, 0.15)'
              : '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
        }}
      >
        {/* Icon + Status Badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            minWidth: 48,
            paddingTop: 2,
          }}
        >
          <span style={{ fontSize: 20 }}>{modeIcon}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: statusColor,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              height: 16,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {statusIcon}
          </span>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Description Row */}
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                color: '#1a2535',
                wordBreak: 'break-word',
                lineHeight: 1.4,
              }}
            >
              {item.note || item.category || '—'}
            </p>
          </div>

          {/* Metadata Badges Row */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            {/* Account Type Badge */}
            {item.account_type && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: 5,
                  fontWeight: 500,
                  fontSize: '11px',
                  color: '#4b5563',
                }}
              >
                {item.account_type}
              </span>
            )}

            {/* Voucher Head Badge */}
            {item.voucher_head && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  backgroundColor: '#ede9fe',
                  color: '#7c3aed',
                  borderRadius: 5,
                  fontWeight: 500,
                  fontSize: '11px',
                }}
              >
                {item.voucher_head}
              </span>
            )}

            {/* Payment Mode Badge */}
            {item.payment_mode && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  borderRadius: 5,
                  fontWeight: 500,
                  fontSize: '11px',
                }}
              >
                {item.payment_mode}
              </span>
            )}

            {/* Date Mismatch Indicator */}
            {dailyIsIncome &&
              item.payment_date &&
              item.entry_date &&
              item.payment_date !== item.entry_date && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#f59e0b',
                    fontWeight: 600,
                  }}
                >
                  {dailyDateMode === 'payment'
                    ? `Entry: ${item.entry_date}`
                    : `Paid: ${item.payment_date}`}
                </span>
              )}
          </div>

          {/* Fraud Alert Box */}
          {isFlagged && fraudFlags?.[item.id] && Array.isArray(fraudFlags[item.id]) && (
            <div style={{ marginTop: 10 }}>
              {fraudFlags[item.id].map((alert, idx) => (
                <div
                  key={`fraud-${item.id}-${idx}`}
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    padding: '6px 8px',
                    backgroundColor: '#fef3c7',
                    borderRadius: 5,
                    fontSize: 11,
                    color: '#92400e',
                    marginBottom: idx < fraudFlags[item.id].length - 1 ? 4 : 0,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ marginTop: '-1px' }}>⚠️</span>
                  <span>{alert?.label || 'Fraud flag detected'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Amount + Balance Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 5,
            minWidth: isMobile ? 100 : 120,
            textAlign: 'right',
            paddingLeft: 8,
          }}
        >
          {/* Amount */}
          <div
            style={{
              fontSize: isMobile ? 14 : 16,
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: dailyAmtColor || '#0a8042',
              lineHeight: 1.2,
            }}
          >
            {fmt(item.amount || 0)}
          </div>

          {/* Running Balance */}
          {balance !== undefined && (
            <div
              style={{
                fontSize: 10,
                color: '#6b7280',
                fontFamily: "'Courier New', monospace",
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              Bal: {fmt(balance)}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginLeft: 4,
            flexShrink: 0,
          }}
        >
          <style>{`
            .txn-edit-btn {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              color: #1e3a5f;
              padding: 6px 8px;
              borderRadius: 6px;
              cursor: pointer;
              fontSize: 13px;
              fontWeight: 500;
              transition: all 0.15s ease;
            }
            .txn-edit-btn:hover {
              background: #dbeafe;
              border-color: #93c5fd;
            }
            .txn-edit-btn:active {
              background: #bfdbfe;
            }

            .txn-memo-btn {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              color: #16a34a;
              padding: 6px 8px;
              borderRadius: 6px;
              cursor: pointer;
              fontSize: 13px;
              fontWeight: 500;
              transition: all 0.15s ease;
            }
            .txn-memo-btn:hover {
              background: #dcfce7;
              border-color: #86efac;
            }
            .txn-memo-btn:active {
              background: #bbf7d0;
            }

            .txn-delete-btn {
              background: #fee2e2;
              border: 1px solid #fecaca;
              color: #dc2626;
              padding: 6px 8px;
              borderRadius: 6px;
              cursor: pointer;
              fontSize: 13px;
              fontWeight: 500;
              transition: all 0.15s ease;
            }
            .txn-delete-btn:hover {
              background: #fecaca;
              border-color: #fca5a5;
            }
            .txn-delete-btn:active {
              background: #fca5a5;
            }
          `}</style>
          <button
            onClick={() => printReceiptMemo(item)}
            className="txn-memo-btn"
            aria-label="Print receipt memo"
            title="Print Receipt Memo"
          >
            🧾
          </button>
          {(canWrite || (canEdit && item.type === 'Expense')) && (
            <button
              onClick={() => openEdit(item)}
              className="txn-edit-btn"
              aria-label="Edit transaction"
              title="Edit"
            >
              ✏️
            </button>
          )}
          {canWrite && (
            <button
              onClick={() => handleDelete(item.id)}
              className="txn-delete-btn"
              aria-label="Delete transaction"
              title="Delete"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    )
  }

  // Empty state
  if (!dayRows || dayRows.length === 0) {
    return (
      <div
        style={{
          paddingTop: 40,
          textAlign: 'center',
          color: '#9ca3af',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>No transactions for this period</p>
        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#d1d5db' }}>
          {dailyIsIncome ? 'No income' : 'No expenses'} recorded yet.
        </p>
      </div>
    )
  }

  // Main render
  return (
    <div style={{ paddingTop: 8, paddingBottom: 16 }}>
      {/* Date Group Headers + Cards */}
      {dates.map((dateKey) => {
        const dateTransactions = grouped[dateKey]
        const lastTxnId = dateTransactions[dateTransactions.length - 1]?.id
        const dateBalance = balanceMap[lastTxnId] || dayTotal
        const dateSum = dateTransactions.reduce((s, t) => s + Number(t.amount || 0), 0)

        return (
          <div key={dateKey} style={{ marginBottom: 24 }}>
            {/* Date Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {formatDate(dateKey)}
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 12,
                  color: '#6b7280',
                }}
              >
                <span>
                  <strong style={{ color: '#374151' }}>{dateTransactions.length}</strong> txn
                </span>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  {fmt(dateSum)}
                </span>
              </div>
            </div>

            {/* Transaction Cards */}
            {dateTransactions.map((item) => {
              const isFlagged = fraudFlags?.[item.id]
              return (
                <TransactionCard
                  key={item.id}
                  item={item}
                  balance={balanceMap[item.id]}
                  isFlagged={isFlagged}
                />
              )
            })}
          </div>
        )
      })}

      {/* Grand Total Summary Footer */}
      {dayRows && dayRows.length > 0 && (
        <div
          style={{
            backgroundColor: '#1a2535',
            borderRadius: 14,
            padding: isMobile ? '16px' : '20px 28px',
            marginTop: 28,
            color: 'white',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 16,
            boxShadow: '0 4px 12px rgba(26, 37, 53, 0.15)',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: 6,
                fontWeight: 500,
              }}
            >
              {dayRows.length} Transaction{dayRows.length !== 1 ? 's' : ''}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? 20 : 26,
                fontWeight: 700,
                fontFamily: "'Courier New', monospace",
                color: '#fbbf24',
              }}
            >
              {fmt(dayTotal)}
            </p>
          </div>

          {/* Breakdown */}
          <div
            style={{
              display: 'flex',
              gap: isMobile ? 16 : 40,
              flexWrap: 'wrap',
            }}
          >
            {dailyCashAmt > 0 && (
              <div>
                <p
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 500,
                  }}
                >
                  💵 Cash
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 16 : 18,
                    fontWeight: 700,
                    fontFamily: "'Courier New', monospace",
                    color: '#fbbf24',
                  }}
                >
                  {fmt(dailyCashAmt)}
                </p>
              </div>
            )}

            {dailyBankAmt > 0 && (
              <div>
                <p
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 500,
                  }}
                >
                  🏦 Bank
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? 16 : 18,
                    fontWeight: 700,
                    fontFamily: "'Courier New', monospace",
                    color: '#e0e7ff',
                  }}
                >
                  {fmt(dailyBankAmt)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsViewBanking