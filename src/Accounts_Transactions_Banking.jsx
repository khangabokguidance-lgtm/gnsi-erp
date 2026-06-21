/**
 * Banking-Style Transactions View
 * For Accounts module — premium statement-like layout
 * Replaces the tabular Daily view with card-based transaction cards
 * 
 * Key features:
 * - Transaction cards (not table rows) for better readability
 * - Fraud flags elevated with subtle warning styling
 * - Running balance inline (shows trust/confidence)
 * - Date grouping with subtle headers
 * - Micro-status indicators (Confirmed, Pending, Flagged)
 * - Mobile-first responsive design
 * - No unnecessary metadata clutter
 */

export const TransactionsViewBanking = ({
  dayRows,        // transactions for selected day
  dailyIsIncome,  // true if viewing Income, false if Expense
  dailyDateMode,  // 'payment' or 'entry'
  dailyAmtColor,  // color for amount text
  dayTotal,       // sum of dayRows amounts
  dailyCashAmt,   // cash subtotal
  dailyBankAmt,   // bank subtotal
  dailyTotalAmt,  // total amount
  fraudFlags,     // map of { entry_id: [{type, label, severity}, ...] }
  canWrite,       // can edit/delete
  fmt,            // currency formatter
  openEdit,       // fn(item)
  handleDelete,   // fn(id)
  isMobile,       // responsive flag
  runningBalance, // optional: array of {id, balance} for running total context
}) => {
  // Compute running balance inline if not provided
  const balances = runningBalance || dayRows.reduce((acc, item, idx) => {
    const prev = acc[idx - 1]?.balance || 0;
    return [...acc, { id: item.id, balance: prev + Number(item.amount) }];
  }, []);

  const balanceMap = Object.fromEntries(balances.map(b => [b.id, b.balance]));

  // Group by date if dayRows spans multiple dates (rare, but prepare for it)
  const grouped = dayRows.reduce((acc, item) => {
    const dateKey = item.entry_date || item.payment_date || '';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  // Format date nicely
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  };

  // Transaction card component
  const TransactionCard = ({ item, balance, isFlagged }) => {
    const modeIcon = {
      Cash: '💵',
      Bank: '🏦',
      UPI: '📱',
      Card: '💳',
      Cheque: '✓',
    }[item.payment_mode] || '💰';

    const statusIcon = isFlagged ? '⚠️' : item.status === 'Confirmed' ? '✓' : '⏳';
    const statusColor = isFlagged
      ? '#fbbf24'
      : item.status === 'Confirmed'
        ? '#16a34a'
        : '#f59e0b';

    return (
      <div
        style={{
          backgroundColor: isFlagged ? '#fffbf0' : 'white',
          border: isFlagged ? '1px solid #fed7aa' : '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 10,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          transition: 'all 0.2s ease',
          ...(isFlagged && {
            boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.1)',
          }),
        }}
      >
        {/* Icon + Status */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            minWidth: 44,
          }}
        >
          <span style={{ fontSize: 20 }}>{modeIcon}</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: statusColor,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
          >
            {statusIcon}
          </span>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Description Row */}
          <div style={{ marginBottom: 6 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: '#1a2535',
                wordBreak: 'break-word',
              }}
            >
              {item.note || item.category || '—'}
            </p>
          </div>

          {/* Metadata Row */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              fontSize: 12,
              color: '#6b7280',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                backgroundColor: '#f3f4f6',
                borderRadius: 5,
                fontWeight: 500,
              }}
            >
              {item.account_type || 'Cash A/c'}
            </span>

            {item.voucher_head && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  backgroundColor: '#ede9fe',
                  color: '#7c3aed',
                  borderRadius: 5,
                  fontWeight: 500,
                }}
              >
                {item.voucher_head}
              </span>
            )}

            {dailyIsIncome &&
              item.payment_date &&
              item.payment_date !== item.entry_date && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#f59e0b',
                    fontWeight: 600,
                  }}
                >
                  {dailyDateMode === 'payment'
                    ? `Entered ${item.entry_date}`
                    : `Paid ${item.payment_date}`}
                </span>
              )}
          </div>

          {/* Fraud Alert */}
          {isFlagged && fraudFlags[item.id] && (
            <div style={{ marginTop: 8 }}>
              {fraudFlags[item.id].map((alert, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    padding: '6px 8px',
                    backgroundColor: '#fef3c7',
                    borderRadius: 5,
                    fontSize: 11,
                    color: '#92400e',
                    marginBottom: idx < fraudFlags[item.id].length - 1 ? 4 : 0,
                  }}
                >
                  <span>⚠️</span>
                  <span style={{ fontWeight: 500 }}>{alert.label}</span>
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
            gap: 4,
            minWidth: 120,
            textAlign: 'right',
          }}
        >
          {/* Amount */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'monospace',
              color: dailyAmtColor,
            }}
          >
            {fmt(item.amount)}
          </div>

          {/* Running Balance */}
          <div
            style={{
              fontSize: 11,
              color: '#9ca3af',
              fontFamily: 'monospace',
              fontWeight: 500,
            }}
          >
            Balance: {fmt(balanceMap[item.id] || 0)}
          </div>
        </div>

        {/* Actions */}
        {canWrite && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginLeft: 4,
            }}
          >
            <button
              onClick={() => openEdit(item)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 5,
                transition: 'all 0.15s ease',
                backgroundColor: '#eff6ff',
                color: '#1e3a5f',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#dbeafe';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#eff6ff';
              }}
            >
              ✏️
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                padding: '4px 8px',
                borderRadius: 5,
                transition: 'all 0.15s ease',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#fecaca';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#fee2e2';
              }}
            >
              🗑
            </button>
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div style={{ paddingTop: 8 }}>
      {/* Date Group Headers + Cards */}
      {dates.map((dateKey) => {
        const dateTransactions = grouped[dateKey];
        const dateBalance = balanceMap[dateTransactions[dateTransactions.length - 1]?.id] || dayTotal;
        const dateSum = dateTransactions.reduce((s, t) => s + Number(t.amount), 0);

        return (
          <div key={dateKey} style={{ marginBottom: 24 }}>
            {/* Date Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1a2535',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {formatDate(dateKey)}
              </h3>
              <span
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  fontFamily: 'monospace',
                }}
              >
                {dateTransactions.length} txn
              </span>
            </div>

            {/* Transaction Cards */}
            {dateTransactions.map((item) => {
              const isFlagged = fraudFlags && fraudFlags[item.id];
              return (
                <TransactionCard
                  key={item.id}
                  item={item}
                  balance={balanceMap[item.id]}
                  isFlagged={isFlagged}
                />
              );
            })}
          </div>
        );
      })}

      {/* Grand Total Summary Footer */}
      <div
        style={{
          backgroundColor: '#1a2535',
          borderRadius: 12,
          padding: isMobile ? '16px' : '20px 28px',
          marginTop: 24,
          color: 'white',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: 16,
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
              marginBottom: 4,
            }}
          >
            {dayRows.length} Transactions
          </p>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              fontFamily: 'monospace',
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
            gap: isMobile ? 16 : 32,
            flexWrap: 'wrap',
          }}
        >
          {dailyCashAmt > 0 && (
            <div>
              <p
                style={{
                  margin: '0 0 4px 0',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                Cash
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 15 : 18,
                  fontWeight: 700,
                  fontFamily: 'monospace',
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
                  margin: '0 0 4px 0',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                Bank
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 15 : 18,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: '#e0e7ff',
                }}
              >
                {fmt(dailyBankAmt)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};