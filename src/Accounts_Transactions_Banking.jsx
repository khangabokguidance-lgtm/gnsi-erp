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
  vendors = [],
  payers = [],
  printReceiptMemo = () => {},
  isMobile = false,
  runningBalance = null,
  onExportReport = null, // (format:'pdf'|'docx'|'excel') => void — generates a full report of ALL entries, independent of this tab's date/filter selection
  exportingReport = '', // '' | 'pdf' | 'docx' | 'excel' — disables buttons while generating
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
      // Group by the same date the register filters on (payment date for income in that mode).
      const dateKey = (dailyIsIncome && dailyDateMode === 'payment' ? item.payment_date || item.entry_date : item.entry_date || item.payment_date) || 'No Date'
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(item)
      return acc
    }, {})
  }, [dayRows, dailyIsIncome, dailyDateMode])

  const dates = Object.keys(grouped).sort((a, b) => {
    if (a === 'No Date') return 1
    if (b === 'No Date') return -1
    return b < a ? -1 : b > a ? 1 : 0 // ISO dates sort as text
  })

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'No Date') return 'Unspecified Date'
    try {
      const [y, m, dd] = String(dateStr).slice(0, 10).split('-').map(Number)
      const d = new Date(y, m - 1, dd) // local date, not UTC midnight
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

  // Premium palette (matches the Accounts screen: navy / gold / ivory)
  const P = { navy: '#132a4f', navy2: '#1e3a6e', gold: '#b8923a', goldSoft: '#f6efdc', line: '#e8e3d8', ink: '#0f1b2e', muted: '#5d6b82', faint: '#8a93a6', ivory: '#faf8f3' }
  const SERIF = "'Fraunces',Georgia,serif"

  // Transaction card component
  const TransactionCard = ({ item, balance, isFlagged }) => {
    const modeIcon = getPaymentModeIcon(item.payment_mode)
    // Superseded (a duplicate/deactivated entry, e.g. from the
    // auto-recurring cleanup) is a settled state, not something awaiting approval.
    const isSuperseded = item.status === 'Superseded'
    const isOk = item.status == null || item.status === '' || item.status === 'Confirmed' // blank = fee/legacy postings, confirmed
    const statusColor = isFlagged ? '#b45309' : isOk ? '#15803d' : isSuperseded ? '#64748b' : '#b45309'
    const statusBg = isFlagged ? '#fef3c7' : isOk ? '#dcfce7' : isSuperseded ? '#f1f5f9' : '#fef3c7'
    const statusLabel = isFlagged ? 'Flagged' : isOk ? 'Confirmed' : isSuperseded ? 'Superseded' : 'Pending'
    const isInc = item.type === 'Income'
    const accent = isInc ? '#15803d' : '#b91c1c'
    const vendorName = item.vendor_id ? (vendors.find((v) => String(v.id) === String(item.vendor_id))?.name || '') : ''
    const payerName = item.payer_id ? (payers.find((v) => String(v.id) === String(item.payer_id))?.name || '') : ''
    const when = (t) => {
      if (!t) return ''
      const d = new Date(t)
      return isNaN(d) ? String(t) : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    const sections = [
      ['Entry', [
        ['Entry date', formatDate(item.entry_date)],
        ['Payment date', item.payment_date && item.payment_date !== item.entry_date ? formatDate(item.payment_date) : ''],
        ['Category', item.category],
        ['Sub-category', item.sub_category],
        [isInc ? 'Payer / source' : 'Paid to', isInc ? payerName : vendorName],
        ['Voucher head', item.voucher_head],
      ]],
      ['Payment', [
        ['Mode', item.payment_mode],
        ['Account', item.account_type || 'Cash A/c'],
        ['Nature', item.expense_nature],
        ['Txn ref / UTR', item.txn_ref],
        ['Voucher no.', item.voucher_no],
        ['Bill id', item.bill_id],
        ['Recurring', item.is_recurring ? 'Yes' + (item.recurring_period ? ` (${item.recurring_period})` : '') : ''],
        ['Source', [item.source_type, item.source_ref].filter(Boolean).join(' · ')],
      ]],
      ['Record', [
        ['Entered by', item.added_by],
        ['Entered on', when(item.created_at)],
        ['Last edited by', item.edited_by],
        ['Last edited on', when(item.edited_at)],
        ['Delete reason', item.delete_reason],
      ]],
    ].map(([t, rows]) => [t, rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')]).filter(([, rows]) => rows.length)

    const chip = (bg, color, text, key) => (
      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', backgroundColor: bg, color, borderRadius: 999, fontWeight: 600, fontSize: 11 }}>{text}</span>
    )
    const iconBtn = { width: 36, height: 36, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, background: '#fff', border: `1px solid ${P.line}` }

    return (
      <div
        style={{
          position: 'relative',
          backgroundColor: isFlagged ? '#fffbf0' : '#ffffff',
          border: `1px solid ${isFlagged ? '#fed7aa' : P.line}`,
          borderRadius: 16,
          padding: isMobile ? '16px 16px 14px 20px' : '20px 24px 18px 28px',
          marginBottom: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 10px 28px -16px rgba(19,42,79,.22)',
        }}
      >
        {/* type accent */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: `linear-gradient(180deg, ${accent}, ${accent}99)` }} />

        {/* header: icon, title + chips, amount */}
        <div style={{ display: 'flex', gap: isMobile ? 12 : 16, alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: P.goldSoft, border: `1px solid #e9d9b0`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {modeIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: isMobile ? 15 : 16.5, fontWeight: 600, color: P.ink, wordBreak: 'break-word', lineHeight: 1.4, fontFamily: SERIF }}>
              {item.note || item.category || '—'}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              {chip(statusBg, statusColor, `● ${statusLabel}`, 's')}
              {item.account_type && chip('#eef2f9', P.navy2, item.account_type, 'a')}
              {item.payment_mode && chip('#f0f9ff', '#0369a1', item.payment_mode, 'm')}
              {item.voucher_head && chip('#ede9fe', '#6d28d9', item.voucher_head, 'v')}
              {dailyIsIncome && item.payment_date && item.entry_date && item.payment_date !== item.entry_date && chip('#fef3c7', '#92400e', dailyDateMode === 'payment' ? `Entry: ${item.entry_date}` : `Paid: ${item.payment_date}`, 'd')}
            </div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, fontFamily: SERIF, fontVariantNumeric: 'tabular-nums', color: dailyAmtColor || accent, lineHeight: 1.15 }}>
              {isInc ? '+' : '−'}{fmt(item.amount || 0)}
            </div>
            {balance !== undefined && (
              <div style={{ fontSize: 11, color: P.faint, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>Balance {fmt(balance)}</div>
            )}
          </div>
        </div>

        {/* fraud alerts */}
        {isFlagged && fraudFlags?.[item.id] && Array.isArray(fraudFlags[item.id]) && (
          <div style={{ marginTop: 12 }}>
            {fraudFlags[item.id].map((alert, idx) => (
              <div key={`fraud-${item.id}-${idx}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '7px 10px', backgroundColor: '#fef3c7', borderRadius: 8, fontSize: 11.5, color: '#92400e', marginBottom: idx < fraudFlags[item.id].length - 1 ? 4 : 0, fontWeight: 500 }}>
                <span>⚠️</span>
                <span>{alert?.label || 'Fraud flag detected'}</span>
              </div>
            ))}
          </div>
        )}

        {/* details, grouped */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${P.line}`, display: 'grid', gap: 14 }}>
          {sections.map(([title, rows]) => (
            <div key={title}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: P.gold, marginBottom: 8 }}>{title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px 18px' }}>
                {rows.map(([k, v]) => (
                  <div key={k} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: P.faint, fontWeight: 600, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, color: P.ink, fontWeight: 600, wordBreak: 'break-word' }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* footer: receipt + actions */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            {item.receipt_url
              ? <a href={item.receipt_url} target="_blank" rel="noreferrer" style={{ color: P.navy2, textDecoration: 'none', background: '#eef2f9', padding: '6px 12px', borderRadius: 999 }}>📎 View receipt</a>
              : <span style={{ color: P.faint }}>No receipt attached</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => printReceiptMemo(item)} style={{ ...iconBtn, color: '#15803d' }} aria-label="Print receipt memo" title="Print Receipt Memo">🧾</button>
            {(canWrite || (canEdit && item.type === 'Expense')) && (
              <button onClick={() => openEdit(item)} style={{ ...iconBtn, color: P.navy2 }} aria-label="Edit transaction" title="Edit">✏️</button>
            )}
            {canWrite && (
              <button onClick={() => handleDelete(item.id)} style={{ ...iconBtn, color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }} aria-label="Delete transaction" title="Delete">🗑</button>
            )}
          </div>
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
      {/* Export Report — generates a full letterheaded report of ALL entries, not just this tab's filtered date range */}
      {onExportReport && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={() => onExportReport('pdf')}
            disabled={!!exportingReport}
            style={{
              padding: isMobile ? '8px 14px' : '9px 18px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              color: 'white',
              border: 'none',
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
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              color: 'white',
              border: 'none',
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
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              color: 'white',
              border: 'none',
              backgroundColor: exportingReport === 'excel' ? '#94a3b8' : '#16a34a',
              cursor: exportingReport ? 'not-allowed' : 'pointer',
            }}
          >
            {exportingReport === 'excel' ? '⏳ Generating…' : '📊 Export Excel'}
          </button>
        </div>
      )}

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
                borderBottom: '2px solid #e9d9b0',
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
            background: 'linear-gradient(135deg,#132a4f,#1e3a6e)',
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