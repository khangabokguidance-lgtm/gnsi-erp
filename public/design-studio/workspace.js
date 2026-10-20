// workspace.js — more room for the canvas in the Backdrop / Banner / Invitation makers.
//  • the inspector is no longer a permanent right-hand column: it floats as a ribbon ABOVE the
//    canvas and only appears while something is selected (✕ closes it until the next selection)
//  • the left panel floats as a rounded card (roomier padding); ◧ or the ☰ Tools handle hides / shows it,
//    and the canvas takes the full width while it is hidden
//  • a fitted page is re-fitted when the panel or window changes size
(function () {
  var app = document.querySelector('.app'), header = document.querySelector('header'), scroller = document.getElementById('scroller')
  var work = document.getElementById('work'), right = document.getElementById('right')
  if (!app || !header || !scroller || !work || !right) return
  var KEY = 'ds_panels', st = {}
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { st = {} }

  var initialFit = wasFitted()   // measure before the layout changes
  var css = document.createElement('style')
  css.textContent =
    // the left panel floats as a rounded card over the editor; the canvas keeps the room beside it,
    // and when the panel is hidden the canvas takes the whole width
    '.app{position:relative;--lw:clamp(230px,18vw,290px);grid-template-columns:minmax(0,1fr)!important}' +
    '.app>#left{position:absolute;left:12px;top:12px;bottom:12px;width:var(--lw);z-index:35;border:1px solid var(--line,#e5e7ee);border-radius:16px;box-shadow:0 14px 40px rgba(20,28,60,.20);overflow:hidden;transition:transform .2s ease,opacity .2s ease}' +
    '.app>#work{margin-left:calc(var(--lw) + 24px)}' +
    '.app.hl>#left{transform:translateX(calc(-100% - 24px));opacity:0;pointer-events:none}' +
    '.app.hl>#work{margin-left:0}' +
    '.app>#left .pane{padding:16px 18px 44px}' +
    '.app>#left .row{margin-bottom:11px}' +
    '.app>#left h4{margin-top:20px}' +
    '.dsp-tab{position:absolute;left:12px;top:12px;z-index:34;display:none;padding:9px 14px;border:1px solid var(--line,#e5e7ee);border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(20,28,60,.16);cursor:pointer;font-weight:700}' +
    '.app.hl>.dsp-tab{display:block}' +
    // the inspector ribbon: floats over the top of the canvas, so selecting never moves the page
    '#work>#right{position:absolute;left:10px;right:10px;top:8px;z-index:30;display:none;flex-direction:column;border:1px solid var(--line,#e5e7ee);border-radius:12px;box-shadow:0 10px 30px rgba(20,28,60,.18);overflow:hidden;background:#fff}' +
    '#work>#right.show{display:flex}' +
    '#work>#right>.tabs{display:flex;align-items:center;border-bottom:1px solid var(--line,#e5e7ee)}' +
    '#work>#right>.tabs button{padding:7px 14px;border-bottom:0!important;flex:0 0 auto}' +
    '#work>#right .rib-x{margin-left:auto;margin-right:8px;border:0;background:none;font-size:16px;cursor:pointer;color:var(--mut,#667)}' +
    '#work>#right #insp,#work>#right #insBody{display:block!important;column-width:240px;column-gap:22px;column-fill:auto;height:clamp(110px,22vh,210px);overflow-x:auto;overflow-y:hidden;padding:10px 14px 12px}' +
    '#work>#right #insEmpty{display:none!important}' +
    '#work>#right .sec,#work>#right .row,#work>#right .chk{break-inside:avoid}' +
    '#work>#right h4{break-after:avoid;margin-top:6px}' +
    '.dsp{display:inline-flex;gap:4px;align-items:center;flex:none}.dsp .btn{white-space:nowrap}'
  document.head.appendChild(css)
  work.insertBefore(right, work.firstChild)

  // The pages keep their zoom state private, so read it from the screen: the page counts as
  // "fitted" when it fills the canvas on one axis (leaving the usual margin); refitting is a
  // click on the page's own Fit button.
  function wasFitted() {
    var pg = document.getElementById('pg') || document.getElementById('page')
    if (!pg) return false
    var r = pg.getBoundingClientRect(), w = scroller.clientWidth, h = scroller.clientHeight
    if (!r.width || r.width > w + 2 || r.height > h + 2) return false
    return (r.width >= w - 130 && r.width <= w - 30) || (r.height >= h - 150 && r.height <= h - 30)
  }
  function refit(wasFit) {
    if (!wasFit) return
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      var f = document.getElementById('zFit'); if (f) f.click()
    }) })
  }

  // ── inspector ribbon: show only while something is selected ──
  var dismissed = false
  function hasSelection() {
    var empty = document.getElementById('insEmpty')                 // banner / invitation
    if (empty) return empty.style.display === 'none'   // set inline by the page; our CSS hides #insEmpty itself
    var t = document.getElementById('inspTitle')                    // backdrop: title is "Inspector" when nothing is selected
    return !!t && t.textContent.trim() !== 'Inspector'
  }
  function syncRibbon() {
    var sel = hasSelection()
    if (!sel) dismissed = false
    right.classList.toggle('show', sel && !dismissed)
  }
  var tabs = right.querySelector('.tabs')
  if (tabs) { var x = document.createElement('button'); x.className = 'rib-x'; x.type = 'button'; x.textContent = '✕'; x.title = 'Close the inspector (reopens when you select something else)'; x.onclick = function () { dismissed = true; syncRibbon() }; tabs.appendChild(x) }
  new MutationObserver(syncRibbon).observe(right, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] })

  // ── left panel toggle ──
  function apply(wasFit) {
    app.classList.toggle('hl', !!st.l)
    bl.classList.toggle('on', !!st.l)
    try { localStorage.setItem(KEY, JSON.stringify({ l: !!st.l })) } catch (e) { /* storage blocked */ }
    refit(wasFit)
  }
  function mk(label, title) { var b = document.createElement('button'); b.className = 'btn sm'; b.textContent = label; b.title = title; b.type = 'button'; return b }
  var bl = mk('◧', 'Hide / show the left panel for the biggest canvas')
  bl.onclick = function () { var f = wasFitted(); st.l = !st.l; apply(f) }
  var tab = document.createElement('button'); tab.type = 'button'; tab.className = 'dsp-tab'; tab.textContent = '☰ Tools'; tab.title = 'Show the tools panel'
  tab.onclick = function () { var f = wasFitted(); st.l = false; apply(f) }
  app.appendChild(tab)
  var wrap = document.createElement('span'); wrap.className = 'dsp'
  wrap.appendChild(bl)
  header.insertBefore(wrap, header.children[1] || null)   // next to the title: the right end of the header is already full

  // Keep a fitted page fitted when the window (or browser zoom) changes.
  var last = scroller.clientWidth + 'x' + scroller.clientHeight, fittedBefore = true
  if (window.ResizeObserver) new ResizeObserver(function () {
    var now = scroller.clientWidth + 'x' + scroller.clientHeight
    if (now !== last) { last = now; if (fittedBefore) refit(true) }
  }).observe(scroller)
  setInterval(function () { if (scroller.clientWidth + 'x' + scroller.clientHeight === last) fittedBefore = wasFitted() }, 500)

  apply(initialFit); syncRibbon()
})()
