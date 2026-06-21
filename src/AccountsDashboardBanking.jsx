/**
 * GNSI ERP — Accounts Overview
 * Single-view treasury dashboard: net balance card, summary metrics, transaction ledger.
 */

import React, { useMemo, useState } from 'react'

export const AccountsDashboardBanking = ({
  entries = [],
  canWrite = false,
  fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`,
  isMobile = false,
  openEdit = () => {},
  handleDelete = () => {}
}) => {
  const [selectedTxn, setSelectedTxn] = useState(null)

  const stats = useMemo(() => {
    const income = entries.filter(e => e.type === 'Income').reduce((s, e) => s + Number(e.amount), 0)
    const expense = entries.filter(e => e.type === 'Expense').reduce((s, e) => s + Number(e.amount), 0)
    const confirmed = entries.filter(e => e.status === 'Confirmed').length
    const pending = entries.filter(e => e.status !== 'Confirmed').length
    return { income, expense, balance: income - expense, confirmed, pending }
  }, [entries])

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date)),
    [entries]
  )

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1D1D1F] to-[#3A3A3C] flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-4 h-4">
            <path d="M3 12l2-2 4 4 8-8 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight">GNSI Treasury</p>
          <p className="text-xs text-[#AEAEB2] leading-tight">Accounts &amp; cash flow</p>
        </div>
      </div>

      {/* Treasury card */}
      <div className="relative rounded-3xl p-8 mb-7 text-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05),0_16px_40px_rgba(0,0,0,0.10)] bg-gradient-to-br from-[#1D1D1F] via-[#2C2C2E] to-[#1D1D1F]">
        <div
          className="absolute -top-[60%] -right-[20%] w-[60%] h-[220%] pointer-events-none"
          style={{
            background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
            transform: 'rotate(8deg)'
          }}
        />
        <div className="flex justify-between items-start mb-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Net balance</p>
            <p className="text-sm font-medium text-white/85 mt-1">GNSI · Khangabok, Thoubal</p>
          </div>
          <div className="w-9 h-[26px] rounded-[5px] bg-gradient-to-br from-[#D4AF6A] to-[#B8915A]" />
        </div>

        <p className="text-[42px] font-semibold m-0 tabular-nums tracking-tight">{fmt(stats.balance)}</p>

        <div className="flex gap-7 mt-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">Income</p>
            <p className="text-[15px] font-medium mt-1 tabular-nums text-[#6FDB9A]">+{fmt(stats.income)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">Expense</p>
            <p className="text-[15px] font-medium mt-1 tabular-nums text-[#FF8A8A]">−{fmt(stats.expense)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">Confirmed</p>
            <p className="text-[15px] font-medium mt-1 tabular-nums">{stats.confirmed} entries</p>
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      <div className={`grid gap-4 mb-7 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.06]">
          <p className="text-xs font-medium text-[#6E6E73]">Pending entries</p>
          <p className="text-[22px] font-semibold mt-2 tabular-nums">{stats.pending}</p>
          <p className="text-xs text-[#AEAEB2] mt-1.5">Awaiting confirmation</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.06]">
          <p className="text-xs font-medium text-[#6E6E73]">Total transactions</p>
          <p className="text-[22px] font-semibold mt-2 tabular-nums">{entries.length}</p>
          <p className="text-xs text-[#AEAEB2] mt-1.5">All time</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.06]">
          <p className="text-xs font-medium text-[#6E6E73]">Income entries</p>
          <p className="text-[22px] font-semibold mt-2 tabular-nums text-[#0A8042]">
            {entries.filter(e => e.type === 'Income').length}
          </p>
          <p className="text-xs text-[#AEAEB2] mt-1.5">Credits recorded</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.06]">
          <p className="text-xs font-medium text-[#6E6E73]">Expense entries</p>
          <p className="text-[22px] font-semibold mt-2 tabular-nums text-[#D70015]">
            {entries.filter(e => e.type === 'Expense').length}
          </p>
          <p className="text-xs text-[#AEAEB2] mt-1.5">Debits recorded</p>
        </div>
      </div>

      {/* Transaction ledger */}
      <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-6 py-5 border-b border-black/[0.06] flex justify-between items-center">
          <div>
            <p className="text-base font-semibold">Recent transactions</p>
            <p className="text-xs text-[#6E6E73] mt-0.5">{entries.length} total · sorted by date</p>
          </div>
        </div>

        <div>
          {sortedEntries.slice(0, isMobile ? 10 : 25).map((entry) => {
            const isIncome = entry.type === 'Income'
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] last:border-b-0 hover:bg-[#FAFAFA] transition cursor-pointer"
                onClick={() => setSelectedTxn(entry)}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-[11px] flex items-center justify-center text-sm flex-shrink-0 ${
                      isIncome ? 'bg-[#E8F7EE] text-[#0A8042]' : 'bg-[#FDEAEC] text-[#D70015]'
                    }`}
                  >
                    {isIncome ? '↑' : '↓'}
                  </div>
                  <div>
                    <p className="text-[14.5px] font-medium">{entry.note || entry.category}</p>
                    <p className="text-xs text-[#AEAEB2] mt-0.5">{entry.entry_date} · {entry.payment_mode}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[15px] font-semibold tabular-nums ${isIncome ? 'text-[#0A8042]' : 'text-[#D70015]'}`}>
                    {isIncome ? '+' : '−'}{fmt(entry.amount)}
                  </p>
                  {entry.status !== 'Confirmed' && (
                    <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-md mt-1 bg-[#FDF1E3] text-[#B25E00]">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {entries.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-[#AEAEB2]">
              No transactions yet.
            </div>
          )}
        </div>
      </div>

      {/* Transaction detail modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-[0_16px_40px_rgba(0,0,0,0.20)]">
            <div className="flex justify-between items-start mb-5">
              <h3 className="text-lg font-semibold">{selectedTxn.note || selectedTxn.category}</h3>
              <button
                onClick={() => setSelectedTxn(null)}
                className="text-[#AEAEB2] hover:text-[#1D1D1F] text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 text-sm mb-6">
              <p><span className="text-[#AEAEB2]">Type</span><span className="float-right font-medium">{selectedTxn.type}</span></p>
              <p><span className="text-[#AEAEB2]">Amount</span><span className="float-right font-medium tabular-nums">{fmt(selectedTxn.amount)}</span></p>
              <p><span className="text-[#AEAEB2]">Date</span><span className="float-right font-medium">{selectedTxn.entry_date}</span></p>
              <p><span className="text-[#AEAEB2]">Mode</span><span className="float-right font-medium">{selectedTxn.payment_mode}</span></p>
              <p><span className="text-[#AEAEB2]">Status</span><span className="float-right font-medium">{selectedTxn.status}</span></p>
            </div>

            {canWrite && (
              <div className="flex gap-2">
                <button
                  onClick={() => { openEdit(selectedTxn); setSelectedTxn(null) }}
                  className="flex-1 px-4 py-2.5 bg-[#1D1D1F] text-white font-medium text-sm rounded-xl"
                >
                  Edit
                </button>
                <button
                  onClick={() => { handleDelete(selectedTxn.id); setSelectedTxn(null) }}
                  className="flex-1 px-4 py-2.5 bg-[#FDEAEC] text-[#D70015] font-medium text-sm rounded-xl"
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