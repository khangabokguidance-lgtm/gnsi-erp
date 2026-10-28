// LandingFooter.jsx — majestic footer: royal call-to-action crown, brand lockup with
// script motto, ornamented link columns, contact card and a seal strip.
// Type: Cinzel (display caps) · Playfair Display (editorial body) · Great Vibes (script).
import './LandingFooter.css';

const ICON = {
  facebook: 'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.13 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.51 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.81 8.44-4.94 8.44-9.94Z',
  youtube: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6Z',
  instagram: 'M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.97.24 2.43.4a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.16.46.35 1.26.4 2.43.07 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.24 1.97-.4 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.16-1.26.35-2.43.4-1.25.07-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.97-.24-2.43-.4a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.16-.46-.35-1.26-.4-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.24-1.97.4-2.43a4.9 4.9 0 0 1 1.15-1.77A4.9 4.9 0 0 1 5.6 1.8c.46-.16 1.26-.35 2.43-.4C9.27 2.2 9.67 2.2 12 2.2Zm0 1.8c-3.16 0-3.53 0-4.77.07-.96.04-1.48.2-1.82.34-.46.18-.78.39-1.13.73-.34.35-.55.67-.73 1.13-.13.34-.3.86-.34 1.82C3.14 8.83 3.14 9.2 3.14 12s0 3.17.07 4.41c.04.96.2 1.48.34 1.82.18.46.39.78.73 1.13.35.34.67.55 1.13.73.34.13.86.3 1.82.34 1.24.07 1.61.07 4.77.07s3.53 0 4.77-.07c.96-.04 1.48-.2 1.82-.34.46-.18.78-.39 1.13-.73.34-.35.55-.67.73-1.13.13-.34.3-.86.34-1.82.07-1.24.07-1.61.07-4.41s0-3.17-.07-4.41c-.04-.96-.2-1.48-.34-1.82a2.9 2.9 0 0 0-.73-1.13 2.9 2.9 0 0 0-1.13-.73c-.34-.13-.86-.3-1.82-.34C15.53 3.84 15.16 3.84 12 3.84Zm0 3.3a4.86 4.86 0 1 1 0 9.72 4.86 4.86 0 0 1 0-9.72Zm0 1.8a3.06 3.06 0 1 0 0 6.12 3.06 3.06 0 0 0 0-6.12Zm5.5-3.18a1.13 1.13 0 1 1 0 2.27 1.13 1.13 0 0 1 0-2.27Z',
  whatsapp: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89Z',
};

function Social({ href, label, icon, wa }) {
  return (
    <a className={'lf-soc' + (wa ? ' lf-soc-wa' : '')} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[icon]} /></svg>
    </a>
  );
}

const Orn = () => <span className="lf-orn" aria-hidden="true"><i /><b>◆</b><i /></span>;

export default function MajesticFooter({ site, emblem, goToTab, actions }) {
  const go = (id) => (e) => { e.preventDefault(); goToTab(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <footer className="lf" aria-label="Site footer">
      <div className="lf-bg" aria-hidden="true"><i className="lf-glow" /><span className="lf-mark">GNSI</span></div>

      {/* ── Crown: the royal call to action ── */}
      <div className="lf-crown">
        <div className="lf-crown-in">
          <div className="lf-crown-tx">
            <span className="lf-script">Begin your journey</span>
            <h2>Shape a future in uniform</h2>
            <p>Admissions are open for Sainik School, Navodaya and RMS preparation — a residential campus built on discipline.</p>
          </div>
          <div className="lf-crown-btns">
            <a href="/apply" className="lf-btn lf-btn-gold">Apply Online</a>
            <a href={site.tel} className="lf-btn lf-btn-ghost">Call {site.phone}</a>
          </div>
        </div>
      </div>

      {/* ── Main columns ── */}
      <div className="lf-main">
        <div className="lf-brand">
          <div className="lf-lockup">
            <span className="lf-crest"><img src={emblem} alt="" width="56" height="56" /></span>
            <span className="lf-name"><strong>Guidance</strong><em>Navodaya &amp; Sainik Institute</em></span>
          </div>
          <p className="lf-motto">“Empowering Future Leaders”</p>
          <p className="lf-about">A residential coaching institute in Khangabok, Thoubal, Manipur — preparing students for the Navodaya, Sainik School and Military School entrance examinations since 2016.</p>
          <Orn />
          <div className="lf-socials">
            <Social href={site.facebook} label="Facebook" icon="facebook" />
            <Social href={site.youtube} label="YouTube" icon="youtube" />
            <Social href={site.instagram} label="Instagram" icon="instagram" />
            <Social href={site.wa} label="WhatsApp" icon="whatsapp" wa />
            {site.whatsappChannel && <a className="lf-soc lf-soc-wa lf-soc-txt" href={site.whatsappChannel} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Channel">CH</a>}
          </div>
        </div>

        <nav className="lf-col" aria-label="Explore">
          <h4>Explore</h4>
          <a href="#courses" onClick={go('courses')}>Courses</a>
          <a href="#results" onClick={go('results')}>Results</a>
          <a href="#rankers" onClick={go('rankers')}>Toppers Wall</a>
          <a href="#faculty" onClick={go('faculty')}>Faculty</a>
          <a href="#facilities" onClick={go('facilities')}>Facilities</a>
          <a href="#hostel" onClick={go('hostel')}>Hostel Life</a>
          <a href="#gallery" onClick={go('gallery')}>Gallery</a>
          <a href="#blog" onClick={go('blog')}>News &amp; Blog</a>
        </nav>

        <nav className="lf-col" aria-label="Admissions">
          <h4>Admissions</h4>
          <a href="/apply">Apply Online</a>
          <a href="/apply-status">Application Status</a>
          <a href="#enquiry" onClick={go('enquiry')}>Enquire Now</a>
          <a href="#scholarship" onClick={go('scholarship')}>Scholarship Test</a>
          <a href="/exam-registration">Exam Registration</a>
          <a href={site.brochure} target="_blank" rel="noopener noreferrer" download="">Download Brochure</a>
          <a href="#alumni" onClick={go('alumni')}>Alumni &amp; TC</a>
          <a href="#careers" onClick={go('careers')}>Careers</a>
        </nav>

        <nav className="lf-col" aria-label="Services">
          <h4>Services</h4>
          <button type="button" onClick={actions.openFee}>Pay Fee Online</button>
          <button type="button" onClick={actions.openPortal}>Parents Portal</button>
          <button type="button" onClick={actions.openVerify}>Verify Fee Receipt</button>
          <a href="/student-leave">Student Leave</a>
          <a href="/store">GNSI Store</a>
          <a href={site.apk} download="">Android App</a>
          <button type="button" onClick={actions.onLogin}>Staff Login</button>
        </nav>

        <address className="lf-col lf-contact">
          <h4>Visit &amp; Contact</h4>
          <p><span aria-hidden="true">⌖</span>{site.address}</p>
          <p><span aria-hidden="true">✆</span><a href={site.tel}>{site.phone}</a></p>
          <p><span aria-hidden="true">✉</span><a href={'mailto:' + site.email}>{site.email}</a></p>
          <p><span aria-hidden="true">◷</span>Mon – Sat · 08:30 – 17:00</p>
        </address>
      </div>

      {/* ── Seal strip ── */}
      <div className="lf-seals" aria-label="Institute highlights">
        {site.stats.slice(0, 3).map((s) => (
          <div className="lf-seal" key={s.label}><strong>{s.value}</strong><span>{s.label}</span></div>
        ))}
        <div className="lf-seal"><strong>2016</strong><span>Established</span></div>
      </div>

      <div className="lf-bottom">
        <span>© 2026 Guidance Navodaya &amp; Sainik Institute · Khangabok, Thoubal, Manipur</span>
        <span className="lf-bottom-r">guidancekhangabok.in</span>
      </div>
    </footer>
  );
}
