// RegistrationCard.jsx — registration-form-style editor for one row.
// ─────────────────────────────────────────────────────────────────────────────
// Replaces per-cell inline editing in Table Browser: clicking a row/card
// opens this instead. Required fields (from requiredFields.js) are shown
// up front with a completion percentage; everything else sits under a
// collapsible "Advanced" section so a 50-column table doesn't dump a wall
// of inputs on open.
//
// Desktop: slide-in panel from the right, table dims behind it.
// Mobile: full-screen modal.
//
// Every field writes through the same editField() used elsewhere in
// Table Browser, one field at a time on blur/save — same whitelist
// behavior (now open to all non-system columns), same audit_logs entry,
// same students->admissions cascade sync. This component does not
// reimplement any of that; it's a different layout over the same save
// path, plus a bulk "Save all changes" that just runs editField per
// dirty field in sequence.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect } from 'react'
import { editField, getEditableFields } from './editEngine'
import { getRequiredFields, getCompletion } from './requiredFields'

const NAVY = '#0B1E3D', RED = '#dc2626', GREEN = '#16a34a', AMBER = '#d97706'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }

function FieldInput({ fieldDef, value, onChange }) {
  const common = { padding: '9px 11px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 13.5, width: '100%', boxSizing: 'border-box' }
  if (fieldDef.type === 'select') {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={common}>
        <option value="">&mdash; not set &mdash;</option>
        {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (fieldDef.type === 'textarea') {
    return <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} rows={3} style={{ ...common, resize: 'vertical', fontFamily: 'inherit' }} />
  }
  if (fieldDef.type === 'date') {
    return <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} style={common} />
  }
  return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} style={common} />
}

function FieldRow({ label, fieldDef, value, onChange, dirty, saveState }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</label>
        {dirty && !saveState && <span style={{ fontSize: 9, color: AMBER, fontWeight: 800 }}>&#9679; unsaved</span>}
        {saveState === 'saving' && <span style={{ fontSize: 9, color: SLATE[400] }}>saving&hellip;</span>}
        {saveState === 'saved' && <span style={{ fontSize: 9, color: GREEN, fontWeight: 800 }}>&#10003; saved</span>}
        {saveState === 'error' && <span style={{ fontSize: 9, color: RED, fontWeight: 800 }}>failed</span>}
      </div>
      <FieldInput fieldDef={fieldDef} value={value} onChange={onChange} />
    </div>
  )
}

export default function RegistrationCard({ row, tableKey, tableLabel, isMobile, studentContext = null, onClose, onSaved }) {
  const editableFields = useMemo(() => getEditableFields(tableKey, row) || {}, [tableKey, row])
  const requiredKeys = useMemo(() => getRequiredFields(tableKey), [tableKey])
  const [draft, setDraft] = useState(() => ({ ...row }))
  const [saveStates, setSaveStates] = useState({})   // field -> 'saving'|'saved'|'error'
  const [errors, setErrors] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  // Reset local draft whenever a different row is opened.
  useEffect(() => { setDraft({ ...row }); setSaveStates({}); setErrors({}) }, [row])

  const completion = useMemo(() => getCompletion(tableKey, draft), [tableKey, draft])

  const requiredCols = requiredKeys.filter(k => editableFields[k])
  const advancedCols = Object.keys(editableFields).filter(k => !requiredKeys.includes(k))

  const setField = (field, value) => {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  const saveField = async (field) => {
    if (draft[field] === row[field]) return   // nothing changed
    setSaveStates(prev => ({ ...prev, [field]: 'saving' }))
    setErrors(prev => ({ ...prev, [field]: null }))
    try {
      await editField({ tableKey, rowId: row.id, field, oldValue: row[field], newValue: draft[field], studentContext })
      setSaveStates(prev => ({ ...prev, [field]: 'saved' }))
      onSaved?.(field, draft[field])
    } catch (e) {
      setSaveStates(prev => ({ ...prev, [field]: 'error' }))
      setErrors(prev => ({ ...prev, [field]: e.message || 'Save failed' }))
    }
  }

  const dirtyFields = Object.keys(draft).filter(k => draft[k] !== row[k] && editableFields[k])

  const saveAllChanges = async () => {
    setSavingAll(true)
    for (const field of dirtyFields) {
      await saveField(field)
    }
    setSavingAll(false)
  }

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${SLATE[200]}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: SLATE[400], textTransform: 'uppercase', letterSpacing: '.04em' }}>{tableLabel}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginTop: 2 }}>
              {row.name || row.student_name || row.applicant_name || `Record ${row.id ?? ''}`}
            </div>
          </div>
          <button onClick={onClose} title="Close"
            style={{ border: 'none', background: SLATE[100], color: SLATE[600], borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
            &#10005; Close
          </button>
        </div>

        {/* Completion bar */}
        {completion && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SLATE[500], marginBottom: 4 }}>
              <span>Registration completion</span>
              <span style={{ fontWeight: 800, color: completion.percent === 100 ? GREEN : completion.percent < 50 ? RED : AMBER }}>
                {completion.filled}/{completion.total} &middot; {completion.percent}%
              </span>
            </div>
            <div style={{ height: 7, background: SLATE[100], borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completion.percent}%`, background: completion.percent === 100 ? GREEN : completion.percent < 50 ? RED : AMBER, borderRadius: 99, transition: 'width .2s' }} />
            </div>
            {completion.missing.length > 0 && (
              <div style={{ fontSize: 10.5, color: SLATE[400], marginTop: 5 }}>
                Missing: {completion.missing.map(f => f.replace(/_/g, ' ')).join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body — scrollable form */}
      <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
        {requiredCols.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.03em' }}>
              Required fields
            </div>
            {requiredCols.map(field => (
              <div key={field}>
                <FieldRow
                  label={editableFields[field].label}
                  fieldDef={editableFields[field]}
                  value={draft[field]}
                  onChange={v => setField(field, v)}
                  dirty={draft[field] !== row[field]}
                  saveState={saveStates[field]}
                />
                {errors[field] && <div style={{ fontSize: 11, color: RED, marginTop: -8, marginBottom: 10 }}>{errors[field]}</div>}
              </div>
            ))}
          </>
        )}

        {advancedCols.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setShowAdvanced(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: showAdvanced ? 12 : 0, fontSize: 12, fontWeight: 800, color: SLATE[500], textTransform: 'uppercase', letterSpacing: '.03em' }}>
              <span style={{ display: 'inline-block', transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>&#9656;</span>
              Advanced &middot; {advancedCols.length} more field{advancedCols.length === 1 ? '' : 's'}
            </button>
            {showAdvanced && advancedCols.map(field => (
              <div key={field}>
                <FieldRow
                  label={editableFields[field].label}
                  fieldDef={editableFields[field]}
                  value={draft[field]}
                  onChange={v => setField(field, v)}
                  dirty={draft[field] !== row[field]}
                  saveState={saveStates[field]}
                />
                {errors[field] && <div style={{ fontSize: 11, color: RED, marginTop: -8, marginBottom: 10 }}>{errors[field]}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: `1px solid ${SLATE[200]}`, flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
        {dirtyFields.length > 0 && (
          <span style={{ fontSize: 11.5, color: SLATE[500], marginRight: 'auto' }}>{dirtyFields.length} unsaved change{dirtyFields.length === 1 ? '' : 's'}</span>
        )}
        <button onClick={onClose}
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', color: SLATE[600], fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          Done
        </button>
        <button onClick={saveAllChanges} disabled={dirtyFields.length === 0 || savingAll}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: dirtyFields.length && !savingAll ? NAVY : SLATE[300], color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: dirtyFields.length && !savingAll ? 'pointer' : 'default' }}>
          {savingAll ? 'Saving…' : `Save all changes${dirtyFields.length ? ` (${dirtyFields.length})` : ''}`}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        {panelContent}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.35)' }} />
      <div style={{ position: 'relative', width: 460, maxWidth: '92vw', height: '100%', background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column' }}>
        {panelContent}
      </div>
    </div>
  )
}