// TestMaker.jsx — Learning Hub → Test & Practice Maker.
// GNSI Test and Practice Maker for AISSEE (Sainik) Class VI and any other exam:
// practice sets, test builder, 150-question Monthly Test, test series, Word (.docx)
// and print (PDF) export. It is one self-contained page,
// public/model-papers/gnsi-test-practice-maker.html, shown here in an iframe. It
// needs no server: its question bank is inside the page and its settings are kept
// in the browser (localStorage), so it works offline too.
//
// perms — { read, add, edit, delete } for the 'testmaker' module. The page makes
// papers and downloads; staff with add or edit rights see it (see learningHubTabs.js).

const PAGE = `${import.meta.env.BASE_URL}model-papers/gnsi-test-practice-maker.html`

export default function TestMaker() {
  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <iframe
        title="Test and Practice Maker"
        src={PAGE}
        allow="clipboard-write"
        style={{
          display: 'block', width: '100%', height: 'calc(100dvh - 150px)', minHeight: 620,
          border: '1px solid #e5e0d4', borderRadius: 16, background: '#e9edf1',
          boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 14px 30px -22px rgba(19,42,79,.4)',
        }}
      />
    </div>
  )
}
