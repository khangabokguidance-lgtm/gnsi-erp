// LandingHeader.jsx — pieces of the majestic header: the slim utility bar (contact,
// language, text-size/contrast, socials) and the centre navigation links.
import './LandingHeader.css';

const I = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
const Ic = ({ n }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
);

export function UtilityBar({ site, fontStep, setFontStep, hiContrast, setHiContrast }) {
  return (
    <>
      <div className="gov-stripe" aria-hidden="true"><i /><i /><i /></div>
      <div className="hd-util" id="langBar">
        <div className="hd-util-l">
          <a className="gov-skip" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.scrollIntoView(); }}>Skip to main content</a>
          <a href={site.tel} className="hd-u"><Ic n="phone" /><span data-en="">{site.phone}</span><span data-hi="">{site.phone}</span></a>
          <a href={'mailto:' + site.email} className="hd-u hd-u-md"><Ic n="mail" />{site.email}</a>
          <span className="hd-u hd-u-lg"><Ic n="pin" /><span data-en="">{site.address}</span><span data-hi="">खंगाबोक, थौबल, मणिपुर</span></span>
        </div>
        <div className="hd-util-r">
          <span className="hd-u hd-u-lg"><Ic n="clock" /><span data-en="">Mon–Sat 08:30–17:00</span><span data-hi="">सोम–शनि 08:30–17:00</span></span>
          <span className="hd-sep hd-u-lg" aria-hidden="true" />
          <span className="gov-a11y" role="group" aria-label="Text size and contrast">
            <button type="button" aria-label="Decrease text size" onClick={() => setFontStep((v) => Math.max(-1, v - 1))}>A-</button>
            <button type="button" aria-label="Normal text size" onClick={() => setFontStep(0)} aria-pressed={fontStep === 0}>A</button>
            <button type="button" aria-label="Increase text size" onClick={() => setFontStep((v) => Math.min(2, v + 1))}>A+</button>
            <button type="button" aria-pressed={hiContrast} aria-label="Toggle high contrast" title="High contrast" onClick={() => setHiContrast((v) => !v)}>HC</button>
          </span>
          <span className="hd-sep" aria-hidden="true" />
          <span className="hd-lang" role="group" aria-label="Language">
            <button className="lang-btn active" onClick={(e) => window.setLang('en', e.currentTarget)}>EN</button>
            <button className="lang-btn" onClick={(e) => window.setLang('hi', e.currentTarget)}>हिंदी</button>
            <a className="lang-btn lx-lang-mni" href={'https://translate.google.com/translate?sl=en&tl=mni-Mtei&u=' + encodeURIComponent('https://guidancekhangabok.in/')} target="_blank" rel="noopener noreferrer" title="Machine-translated to Meitei Mayek by Google Translate">ꯃꯤꯇꯩ</a>
          </span>
        </div>
      </div>
    </>
  );
}

const LINKS = [
  ['courses', 'Courses'], ['results', 'Results'], ['rankers', 'Toppers'], ['hostel', 'Hostel'], ['scholarship', 'Scholarship'], ['enquiry', 'Admissions'],
];
export function HeaderLinks({ active, goToTab }) {
  return (
    <ul className="hd-links" aria-label="Primary">
      {LINKS.map(([id, label]) => (
        <li key={id}>
          <a href={'#' + id} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); goToTab(id); }}>{label}</a>
        </li>
      ))}
    </ul>
  );
}
