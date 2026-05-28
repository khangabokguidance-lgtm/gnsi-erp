const NAVY = '#0B1E3D'
const GOLD = '#C9A84C'
const CARD_BG = '#0f2548'

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{ background: NAVY, color: '#fff', minHeight: '100vh', fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      {/* Nav */}
      <div style={{ background: 'rgba(11,30,61,0.95)', borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '1rem 5%', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>← Back</button>
        <span style={{ fontFamily: 'Georgia,serif', fontSize: '1rem', color: '#E8C96A', fontWeight: 700 }}>GNSI Portal</span>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 5%' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>Privacy Policy</h1>
        <p style={{ color: '#8899BB', fontSize: '0.85rem', marginBottom: '3rem' }}>Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        {[
          {
            title: '1. Information We Collect',
            content: `When you submit an enquiry through our website, we collect:
• Your name and parent/guardian name
• Phone number
• Class or course you are interested in
• Any message you choose to provide

We also collect basic analytics data (page views, visit duration) through Google Analytics to improve our website.`
          },
          {
            title: '2. How We Use Your Information',
            content: `We use the information you provide to:
• Contact you regarding your admission enquiry
• Provide information about our courses and programmes
• Send relevant updates about admissions and events
• Improve our services and website experience

We do not sell, trade, or rent your personal information to third parties.`
          },
          {
            title: '3. Data Storage',
            content: `Your enquiry data is stored securely in our Supabase database hosted on secure cloud servers. We implement appropriate technical measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.`
          },
          {
            title: '4. Cookies',
            content: `Our website uses cookies to:
• Remember your preferences
• Analyze website traffic (via Google Analytics)
• Improve website performance

You can choose to disable cookies in your browser settings. This may affect some functionality of the website.`
          },
          {
            title: '5. Third-Party Services',
            content: `We use the following third-party services:
• Google Analytics — for website traffic analysis
• Supabase — for secure data storage
• Google Maps — for location display

These services have their own privacy policies and data practices.`
          },
          {
            title: '6. Your Rights',
            content: `You have the right to:
• Access the personal information we hold about you
• Request correction of inaccurate information
• Request deletion of your personal data
• Opt out of communications from us

To exercise these rights, contact us at +91 89742 98074.`
          },
          {
            title: '7. Contact Us',
            content: `If you have any questions about this Privacy Policy, please contact us:

Guidance Navodaya & Sainik Institute
Khangabok Sorok Wangma, Near Community Hall
Thoubal, Manipur — 795138
Phone: +91 89742 98074`
          },
        ].map(({ title, content }) => (
          <div key={title} style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '1.1rem', fontWeight: 700, color: '#E8C96A', marginBottom: '0.8rem' }}>{title}</h2>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{content}</p>
          </div>
        ))}

        <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '1.2rem', marginTop: '2rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
          By using our website and submitting an enquiry, you agree to this Privacy Policy. We may update this policy from time to time. Continued use of our website constitutes acceptance of any changes.
        </div>
      </div>
    </div>
  )
}