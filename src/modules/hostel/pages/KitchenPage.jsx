import { useState } from 'react';
import { useKitchen } from '../hooks/useKitchen';
import { today, nextId, fmtDate, MEAL_COLORS } from '../utils/hostelUtils';

const MEAL_TYPES   = ['Breakfast','Lunch','Snacks','Dinner'];
const STOCK_UNITS  = ['kg','g','litre','ml','pieces','packets','boxes','bags'];
const ITEM_CATS    = ['Vegetables','Fruits','Grains','Dairy','Meat','Spices','Oil','Others'];

export default function KitchenPage() {
  const { stockItems, menuEntries, dailyStock, stockLog, loading,
    saveStockItems, saveMenuEntries, saveDailyStock, appendLog } = useKitchen();
  const [tab, setTab] = useState('menu');

  if (loading) return <div className="page-loading">Loading…</div>;

  const TABS = [
    ['menu',    '🍽 Menu Planner'],
    ['stock',   '📦 Stock Items'],
    ['daily',   '📋 Daily Stock'],
    ['log',     '📜 Stock Log'],
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding — Kitchen</div>
        <div className="page-header-title">Kitchen Management</div>
        <div className="page-header-sub">Menu · Stock · Daily Inventory · Log</div>
      </div>

      {/* KPI Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:20 }}>
        {[
          ["Today's Menu",     menuEntries.filter(r => r.date === today()).length,                            '#1d4ed8'],
          ['Low Stock',        stockItems.filter(r => Number(r.quantity) <= Number(r.reorderLevel||0)).length,'#dc2626'],
          ['Stock Items',      stockItems.length,                                                              '#7c3aed'],
          ['Log Entries',      stockLog.length,                                                                '#16a34a'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase' }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:800, color, margin:'4px 0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'8px 16px', borderRadius:8,
              border: tab === id ? 'none' : '1.5px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface)',
              color: tab === id ? '#fff' : 'var(--muted)',
              fontWeight: tab === id ? 700 : 600, cursor:'pointer', fontSize:13 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'menu'  && <MenuTab  entries={menuEntries}  onSave={saveMenuEntries} />}
      {tab === 'stock' && <StockTab items={stockItems}     onSave={saveStockItems}  appendLog={appendLog} />}
      {tab === 'daily' && <DailyStockTab items={dailyStock} stockItems={stockItems} onSave={saveDailyStock} />}
      {tab === 'log'   && <LogTab   log={stockLog} />}
    </div>
  );
}

/* ── MENU PLANNER ───────────────────────────────────── */
function MenuTab({ entries, onSave }) {
  const [form, setForm] = useState({ date: today(), meal: 'Breakfast', items: '', notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  const todayMenu = entries.filter(r => r.date === today());

  return (
    <>
      {/* Today's menu quick view */}
      {todayMenu.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:18 }}>
          {MEAL_TYPES.map(meal => {
            const entry = todayMenu.find(r => r.meal === meal);
            const color = MEAL_COLORS[meal] || '#6b7280';
            return (
              <div key={meal} className="card" style={{ padding:'14px 16px', borderLeft:`3.5px solid ${color}` }}>
                <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', marginBottom:4 }}>{meal}</div>
                <div style={{ fontSize:13, fontWeight:600 }}>{entry ? entry.items : <span style={{ color:'var(--muted)', fontStyle:'italic' }}>Not planned</span>}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Form */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Plan Meal</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label>
            <input type="date" value={form.date} onChange={set('date')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Meal</label>
            <select value={form.meal} onChange={set('meal')} style={is}>
              {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Menu Items (e.g. Rice, Dal, Sabzi, Salad)</label>
            <input value={form.items} onChange={set('items')} placeholder="Enter menu items separated by commas" style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Notes</label>
            <input value={form.notes} onChange={set('notes')} style={is} />
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.items) return alert('Enter menu items');
            onSave([...entries, { id: nextId(entries), ...form }]);
            setForm({ date: today(), meal:'Breakfast', items:'', notes:'' });
          }}>Save Meal Plan</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Menu Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{entries.length} entries</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Meal</th><th>Items</th><th>Notes</th><th>Del</th></tr></thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No menu planned yet.</td></tr>
              ) : entries.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td>
                    <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10.5, fontWeight:700,
                      background:(MEAL_COLORS[r.meal]||'#6b7280')+'22',
                      color: MEAL_COLORS[r.meal]||'#6b7280',
                      border:`1px solid ${MEAL_COLORS[r.meal]||'#6b7280'}55` }}>
                      {r.meal}
                    </span>
                  </td>
                  <td style={{ fontSize:13 }}>{r.items}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.notes || '—'}</td>
                  <td>
                    <button onClick={() => onSave(entries.filter(x => x.id !== r.id))}
                      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── STOCK ITEMS ────────────────────────────────────── */
function StockTab({ items, onSave, appendLog }) {
  const [form, setForm] = useState({ name:'', category: ITEM_CATS[0], unit: STOCK_UNITS[0], quantity:0, reorderLevel:5, supplier:'', notes:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  const lowStock = items.filter(r => Number(r.quantity) <= Number(r.reorderLevel || 0));

  return (
    <>
      {lowStock.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12.5, color:'#dc2626' }}>
          ⚠️ <b>Low Stock Alert:</b> {lowStock.map(r => r.name).join(', ')}
        </div>
      )}

      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Add Stock Item</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Item Name</label>
            <input value={form.name} onChange={set('name')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Category</label>
            <select value={form.category} onChange={set('category')} style={is}>
              {ITEM_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Unit</label>
            <select value={form.unit} onChange={set('unit')} style={is}>
              {STOCK_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Current Quantity</label>
            <input type="number" value={form.quantity} onChange={set('quantity')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Reorder Level</label>
            <input type="number" value={form.reorderLevel} onChange={set('reorderLevel')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Supplier</label>
            <input value={form.supplier} onChange={set('supplier')} style={is} />
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name) return alert('Enter item name');
            onSave([...items, { id: nextId(items), ...form }]);
            setForm({ name:'', category:ITEM_CATS[0], unit:STOCK_UNITS[0], quantity:0, reorderLevel:5, supplier:'', notes:'' });
          }}>Add Item</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Stock Items</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{items.length} items · {lowStock.length} low</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Unit</th><th>Reorder</th><th>Supplier</th><th>Status</th><th>Update Qty</th><th>Del</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No stock items added.</td></tr>
              ) : items.map(r => {
                const isLow = Number(r.quantity) <= Number(r.reorderLevel || 0);
                return (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td style={{ fontSize:12 }}>{r.category}</td>
                    <td style={{ fontFamily:'monospace', fontWeight:700, color: isLow ? '#dc2626' : '#16a34a', fontSize:14 }}>{r.quantity}</td>
                    <td style={{ fontSize:12, color:'var(--muted)' }}>{r.unit}</td>
                    <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--muted)' }}>{r.reorderLevel}</td>
                    <td style={{ fontSize:12 }}>{r.supplier || '—'}</td>
                    <td>
                      <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10.5, fontWeight:700,
                        background: isLow ? '#fee2e2' : '#f0fdf4',
                        color: isLow ? '#dc2626' : '#16a34a',
                        border: `1px solid ${isLow ? '#fca5a5' : '#86efac'}` }}>
                        {isLow ? 'Low' : 'OK'}
                      </span>
                    </td>
                    <td>
                      <input type="number" defaultValue={r.quantity} id={`qty_${r.id}`}
                        style={{ width:60, padding:'4px 6px', borderRadius:6, border:'1.5px solid var(--border)', fontSize:12, background:'var(--surface)', color:'var(--text)' }} />
                      <button
                        onClick={() => {
                          const newQty = Number(document.getElementById(`qty_${r.id}`).value);
                          const updated = items.map(x => x.id === r.id ? { ...x, quantity: newQty } : x);
                          onSave(updated);
                          appendLog({ date: today(), item: r.name, oldQty: r.quantity, newQty, unit: r.unit, by: 'Staff' });
                        }}
                        style={{ marginLeft:4, padding:'4px 10px', borderRadius:6, border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:11, cursor:'pointer' }}>
                        Save
                      </button>
                    </td>
                    <td>
                      <button onClick={() => { if (confirm('Delete?')) onSave(items.filter(x => x.id !== r.id)); }}
                        style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── DAILY STOCK ────────────────────────────────────── */
function DailyStockTab({ items, stockItems, onSave }) {
  const [form, setForm] = useState({ date: today(), item: stockItems[0]?.name || '', usedQty: 0, unit: stockItems[0]?.unit || '', receivedQty: 0, notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  const todayItems = items.filter(r => r.date === today());

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Record Daily Usage & Receipt</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label>
            <input type="date" value={form.date} onChange={set('date')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Item</label>
            {stockItems.length > 0 ? (
              <select value={form.item} onChange={e => {
                const found = stockItems.find(s => s.name === e.target.value);
                setForm(f => ({ ...f, item: e.target.value, unit: found?.unit || '' }));
              }} style={is}>
                {stockItems.map(s => <option key={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <input value={form.item} onChange={set('item')} placeholder="Enter item name" style={is} />
            )}
          </div>
          {[['usedQty','Qty Used','number'],['receivedQty','Qty Received','number'],['unit','Unit','text'],['notes','Notes','text']].map(([key,label,type]) => (
            <div key={key}>
              <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} style={is} />
            </div>
          ))}
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.item) return alert('Select or enter an item');
            onSave([...items, { id: nextId(items), ...form }]);
            setForm({ date: today(), item: stockItems[0]?.name||'', usedQty:0, unit: stockItems[0]?.unit||'', receivedQty:0, notes:'' });
          }}>Record Entry</button>
        </div>
      </div>

      {/* Today's summary */}
      {todayItems.length > 0 && (
        <div style={{ background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:10, padding:'10px 16px', marginBottom:14, fontSize:12.5, color:'#16a34a' }}>
          📋 <b>Today recorded:</b> {todayItems.length} items
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="card-title">Daily Stock Log</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{items.length} entries</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Used</th><th>Received</th><th>Unit</th><th>Notes</th><th>Del</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No daily stock entries.</td></tr>
              ) : items.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td><b>{r.item}</b></td>
                  <td style={{ fontFamily:'monospace', fontWeight:700, color:'#dc2626' }}>{r.usedQty || 0}</td>
                  <td style={{ fontFamily:'monospace', fontWeight:700, color:'#16a34a' }}>{r.receivedQty || 0}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.unit || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.notes || '—'}</td>
                  <td>
                    <button onClick={() => { if (confirm('Delete?')) onSave(items.filter(x => x.id !== r.id)); }}
                      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── STOCK LOG ──────────────────────────────────────── */
function LogTab({ log }) {
  const [search, setSearch] = useState('');
  const filtered = log.filter(r => !search || r.item?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div style={{ marginBottom:14 }}>
        <input placeholder="Search item…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', minWidth:260 }} />
      </div>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Quantity Update Log</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{log.length} entries</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>#</th><th>Date</th><th>Item</th><th>Old Qty</th><th>New Qty</th><th>Unit</th><th>Updated By</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No log entries.</td></tr>
              ) : filtered.slice().reverse().map((r, i) => (
                <tr key={r.id}>
                  <td style={{ textAlign:'center', fontFamily:'monospace', color:'var(--muted)', fontSize:11 }}>{filtered.length - i}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td><b>{r.item}</b></td>
                  <td style={{ fontFamily:'monospace', color:'#dc2626', fontWeight:700 }}>{r.oldQty}</td>
                  <td style={{ fontFamily:'monospace', color:'#16a34a', fontWeight:700 }}>{r.newQty}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.unit || '—'}</td>
                  <td style={{ fontSize:12 }}>{r.by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
