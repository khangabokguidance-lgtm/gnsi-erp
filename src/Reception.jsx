import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const tabs = ['Enquiry', 'Visitor Book', 'Gate Pass', 'Parent Items']

const enquiryFormDefault = {
  student_name: '',
  parent_name: '',
  phone: '',
  class_interest: '',
  source: '',
  enquiry_date: new Date().toISOString().split('T')[0],
  follow_up_date: '',
  status: 'New',
  remarks: '',
}

const visitorFormDefault = {
  visitor_name: '',
  phone: '',
  purpose: '',
  meeting_with: '',
  in_time: '',
  out_time: '',
  visit_date: new Date().toISOString().split('T')[0],
  id_proof: '',
  remarks: '',
}

const gatePassFormDefault = {
  student_name: '',
  class_name: '',
  reason: '',
  exit_date: new Date().toISOString().split('T')[0],
  exit_time: '',
  approved_by: '',
  parent_informed: 'No',
  status: 'Issued',
  remarks: '',
}

const parentItemFormDefault = {
  parent_name: '',
  student_name: '',
  class_name: '',
  item_name: '',
  quantity: '',
  received_date: new Date().toISOString().split('T')[0],
  received_by: '',
  status: 'Pending',
  remarks: '',
}

function ReceptionPage() {
  const [activeTab, setActiveTab] = useState('Enquiry')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [enquiries, setEnquiries] = useState([])
  const [visitors, setVisitors] = useState([])
  const [gatePasses, setGatePasses] = useState([])
  const [parentItems, setParentItems] = useState([])

  const [enquiryForm, setEnquiryForm] = useState(enquiryFormDefault)
  const [visitorForm, setVisitorForm] = useState(visitorFormDefault)
  const [gatePassForm, setGatePassForm] = useState(gatePassFormDefault)
  const [parentItemForm, setParentItemForm] = useState(parentItemFormDefault)

  const fetchAllData = async () => {
    setLoading(true)

    const [
      enquiriesRes,
      visitorsRes,
      gatePassesRes,
      parentItemsRes
    ] = await Promise.all([
      supabase.from('reception_enquiries').select('*').order('created_at', { ascending: false }),
      supabase.from('reception_visitors').select('*').order('created_at', { ascending: false }),
      supabase.from('reception_gatepasses').select('*').order('created_at', { ascending: false }),
      supabase.from('reception_parent_items').select('*').order('created_at', { ascending: false }),
    ])

    if (!enquiriesRes.error) setEnquiries(enquiriesRes.data || [])
    if (!visitorsRes.error) setVisitors(visitorsRes.data || [])
    if (!gatePassesRes.error) setGatePasses(gatePassesRes.data || [])
    if (!parentItemsRes.error) setParentItems(parentItemsRes.data || [])

    setLoading(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const stats = {
    enquiries: enquiries.length,
    visitors: visitors.length,
    gatePasses: gatePasses.length,
    parentItems: parentItems.length,
  }

  const currentRows = useMemo(() => {
    const q = search.toLowerCase()

    if (activeTab === 'Enquiry') {
      return enquiries.filter(item =>
        (item.student_name || '').toLowerCase().includes(q) ||
        (item.parent_name || '').toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.class_interest || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      )
    }

    if (activeTab === 'Visitor Book') {
      return visitors.filter(item =>
        (item.visitor_name || '').toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        (item.purpose || '').toLowerCase().includes(q) ||
        (item.meeting_with || '').toLowerCase().includes(q)
      )
    }

    if (activeTab === 'Gate Pass') {
      return gatePasses.filter(item =>
        (item.student_name || '').toLowerCase().includes(q) ||
        (item.class_name || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      )
    }

    return parentItems.filter(item =>
      (item.parent_name || '').toLowerCase().includes(q) ||
      (item.student_name || '').toLowerCase().includes(q) ||
      (item.class_name || '').toLowerCase().includes(q) ||
      (item.item_name || '').toLowerCase().includes(q) ||
      (item.status || '').toLowerCase().includes(q)
    )
  }, [activeTab, enquiries, visitors, gatePasses, parentItems, search])

  const handleInsert = async (table, payload, resetForm) => {
    setSaving(true)
    const { error } = await supabase.from(table).insert([payload])

    if (error) {
      alert(error.message)
    } else {
      resetForm()
      fetchAllData()
    }

    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    const ok = window.confirm('Delete this record?')
    if (!ok) return

    const { error } = await supabase.from(table).delete().eq('id', id)

    if (error) {
      alert(error.message)
    } else {
      fetchAllData()
    }
  }

  const tabButtonStyle = (tab) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    backgroundColor: activeTab === tab ? '#1e3a5f' : '#e2e8f0',
    color: activeTab === tab ? '#fff' : '#334155',
  })

  const cardStyle = {
    background: '#fff',
    borderRadius: '12px',
    padding: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', color: '#1e3a5f', marginBottom: '6px' }}>🛎 Reception Management</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Manage enquiries, visitors, gate passes, and items collected from parents
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Enquiries</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.enquiries}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #0f766e' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Visitors</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.visitors}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #ca8a04' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Gate Passes</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.gatePasses}</div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Parent Items</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e3a5f' }}>{stats.parentItems}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabButtonStyle(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: '20px' }}>
        <input
          style={inputStyle}
          placeholder={`Search ${activeTab.toLowerCase()} records...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {activeTab === 'Enquiry' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Enquiry</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('reception_enquiries', enquiryForm, () =>
                setEnquiryForm({
                  ...enquiryFormDefault,
                  enquiry_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Student Name</label>
                <input style={inputStyle} required value={enquiryForm.student_name} onChange={(e) => setEnquiryForm({ ...enquiryForm, student_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Parent Name</label>
                <input style={inputStyle} value={enquiryForm.parent_name} onChange={(e) => setEnquiryForm({ ...enquiryForm, parent_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={enquiryForm.phone} onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Class Interest</label>
                <input style={inputStyle} value={enquiryForm.class_interest} onChange={(e) => setEnquiryForm({ ...enquiryForm, class_interest: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <input style={inputStyle} placeholder="Walk-in / Phone / Referral" value={enquiryForm.source} onChange={(e) => setEnquiryForm({ ...enquiryForm, source: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Enquiry Date</label>
                <input type="date" style={inputStyle} value={enquiryForm.enquiry_date} onChange={(e) => setEnquiryForm({ ...enquiryForm, enquiry_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Follow Up Date</label>
                <input type="date" style={inputStyle} value={enquiryForm.follow_up_date} onChange={(e) => setEnquiryForm({ ...enquiryForm, follow_up_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={enquiryForm.status} onChange={(e) => setEnquiryForm({ ...enquiryForm, status: e.target.value })}>
                  <option value="New">New</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Converted">Converted</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={enquiryForm.remarks} onChange={(e) => setEnquiryForm({ ...enquiryForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ marginTop: '16px', background: '#1e3a5f', color: '#fff', padding: '10px 18px', borderRadius: '8px' }}>
              {saving ? 'Saving...' : 'Save Enquiry'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Visitor Book' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Visitor</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('reception_visitors', visitorForm, () =>
                setVisitorForm({
                  ...visitorFormDefault,
                  visit_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Visitor Name</label>
                <input style={inputStyle} required value={visitorForm.visitor_name} onChange={(e) => setVisitorForm({ ...visitorForm, visitor_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={visitorForm.phone} onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Purpose</label>
                <input style={inputStyle} required value={visitorForm.purpose} onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Meeting With</label>
                <input style={inputStyle} value={visitorForm.meeting_with} onChange={(e) => setVisitorForm({ ...visitorForm, meeting_with: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>In Time</label>
                <input type="time" style={inputStyle} value={visitorForm.in_time} onChange={(e) => setVisitorForm({ ...visitorForm, in_time: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Out Time</label>
                <input type="time" style={inputStyle} value={visitorForm.out_time} onChange={(e) => setVisitorForm({ ...visitorForm, out_time: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Visit Date</label>
                <input type="date" style={inputStyle} value={visitorForm.visit_date} onChange={(e) => setVisitorForm({ ...visitorForm, visit_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>ID Proof</label>
                <input style={inputStyle} value={visitorForm.id_proof} onChange={(e) => setVisitorForm({ ...visitorForm, id_proof: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={visitorForm.remarks} onChange={(e) => setVisitorForm({ ...visitorForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ marginTop: '16px', background: '#1e3a5f', color: '#fff', padding: '10px 18px', borderRadius: '8px' }}>
              {saving ? 'Saving...' : 'Save Visitor'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Gate Pass' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Gate Pass</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('reception_gatepasses', gatePassForm, () =>
                setGatePassForm({
                  ...gatePassFormDefault,
                  exit_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Student Name</label>
                <input style={inputStyle} required value={gatePassForm.student_name} onChange={(e) => setGatePassForm({ ...gatePassForm, student_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Class</label>
                <input style={inputStyle} value={gatePassForm.class_name} onChange={(e) => setGatePassForm({ ...gatePassForm, class_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input style={inputStyle} required value={gatePassForm.reason} onChange={(e) => setGatePassForm({ ...gatePassForm, reason: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Exit Date</label>
                <input type="date" style={inputStyle} value={gatePassForm.exit_date} onChange={(e) => setGatePassForm({ ...gatePassForm, exit_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Exit Time</label>
                <input type="time" style={inputStyle} value={gatePassForm.exit_time} onChange={(e) => setGatePassForm({ ...gatePassForm, exit_time: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Approved By</label>
                <input style={inputStyle} value={gatePassForm.approved_by} onChange={(e) => setGatePassForm({ ...gatePassForm, approved_by: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Parent Informed</label>
                <select style={inputStyle} value={gatePassForm.parent_informed} onChange={(e) => setGatePassForm({ ...gatePassForm, parent_informed: e.target.value })}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={gatePassForm.status} onChange={(e) => setGatePassForm({ ...gatePassForm, status: e.target.value })}>
                  <option value="Issued">Issued</option>
                  <option value="Exited">Exited</option>
                  <option value="Returned">Returned</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={gatePassForm.remarks} onChange={(e) => setGatePassForm({ ...gatePassForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ marginTop: '16px', background: '#1e3a5f', color: '#fff', padding: '10px 18px', borderRadius: '8px' }}>
              {saving ? 'Saving...' : 'Save Gate Pass'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'Parent Items' && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>Add Parent Item Collection</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInsert('reception_parent_items', parentItemForm, () =>
                setParentItemForm({
                  ...parentItemFormDefault,
                  received_date: new Date().toISOString().split('T')[0],
                })
              )
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Parent Name</label>
                <input style={inputStyle} required value={parentItemForm.parent_name} onChange={(e) => setParentItemForm({ ...parentItemForm, parent_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Student Name</label>
                <input style={inputStyle} required value={parentItemForm.student_name} onChange={(e) => setParentItemForm({ ...parentItemForm, student_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Class</label>
                <input style={inputStyle} value={parentItemForm.class_name} onChange={(e) => setParentItemForm({ ...parentItemForm, class_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Item Name</label>
                <input style={inputStyle} required value={parentItemForm.item_name} onChange={(e) => setParentItemForm({ ...parentItemForm, item_name: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Quantity</label>
                <input style={inputStyle} value={parentItemForm.quantity} onChange={(e) => setParentItemForm({ ...parentItemForm, quantity: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Received Date</label>
                <input type="date" style={inputStyle} value={parentItemForm.received_date} onChange={(e) => setParentItemForm({ ...parentItemForm, received_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Received By</label>
                <input style={inputStyle} value={parentItemForm.received_by} onChange={(e) => setParentItemForm({ ...parentItemForm, received_by: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={parentItemForm.status} onChange={(e) => setParentItemForm({ ...parentItemForm, status: e.target.value })}>
                  <option value="Pending">Pending</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Returned">Returned</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Remarks</label>
                <textarea rows="3" style={inputStyle} value={parentItemForm.remarks} onChange={(e) => setParentItemForm({ ...parentItemForm, remarks: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ marginTop: '16px', background: '#1e3a5f', color: '#fff', padding: '10px 18px', borderRadius: '8px' }}>
              {saving ? 'Saving...' : 'Save Parent Item'}
            </button>
          </form>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginBottom: '16px', color: '#1e3a5f' }}>{activeTab} Records</h2>
        {loading ? (
          <div style={{ color: '#64748b' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                {activeTab === 'Enquiry' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Parent</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Visitor Book' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Visitor</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Purpose</th>
                    <th style={thStyle}>Meeting With</th>
                    <th style={thStyle}>Visit Date</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Gate Pass' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Exit Date</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}

                {activeTab === 'Parent Items' && (
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Parent</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Class</th>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                )}
              </thead>

              <tbody>
                {currentRows.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {activeTab === 'Enquiry' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.student_name}</td>
                        <td style={tdStyle}>{item.parent_name || '-'}</td>
                        <td style={tdStyle}>{item.phone || '-'}</td>
                        <td style={tdStyle}>{item.class_interest || '-'}</td>
                        <td style={tdStyle}>{item.status || '-'}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('reception_enquiries', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Visitor Book' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.visitor_name}</td>
                        <td style={tdStyle}>{item.phone || '-'}</td>
                        <td style={tdStyle}>{item.purpose}</td>
                        <td style={tdStyle}>{item.meeting_with || '-'}</td>
                        <td style={tdStyle}>{item.visit_date}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('reception_visitors', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Gate Pass' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.student_name}</td>
                        <td style={tdStyle}>{item.class_name || '-'}</td>
                        <td style={tdStyle}>{item.reason}</td>
                        <td style={tdStyle}>{item.status || '-'}</td>
                        <td style={tdStyle}>{item.exit_date}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('reception_gatepasses', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}

                    {activeTab === 'Parent Items' && (
                      <>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.parent_name}</td>
                        <td style={tdStyle}>{item.student_name}</td>
                        <td style={tdStyle}>{item.class_name || '-'}</td>
                        <td style={tdStyle}>{item.item_name}</td>
                        <td style={tdStyle}>{item.status || '-'}</td>
                        <td style={tdStyle}>
                          <button onClick={() => handleDelete('reception_parent_items', item.id)} style={deleteBtnStyle}>Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {currentRows.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  fontSize: '13px',
  color: '#475569',
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle = {
  padding: '12px',
  color: '#334155',
}

const deleteBtnStyle = {
  background: '#fee2e2',
  color: '#dc2626',
  border: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '600',
}

export default ReceptionPage