// workspace.js — more room for the canvas in the Backdrop / Banner / Invitation makers.
//  • narrower side panels that scale with the window (clamp) instead of fixed / growing widths
//  • header buttons to hide the left panel, the right inspector, or both ("Canvas only"); remembered
//  • if the page was fitted to the window, it is re-fitted after the panels or window change size
(function () {
  var app = document.querySelector('.app'), header = document.querySelector('header'), scroller = document.getElementById('scroller')
  if (!app || !header || !scroller) return
  var KEY = 'ds_panels', st = {}
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch (e) { st = {} }

  var css = document.createElement('style')
  css.textContent =
    '.app{grid-template-columns:clamp(210px,17vw,280px) minmax(0,1fr) clamp(230px,20vw,300px)!important}' +
    '.app.hl{grid-template-columns:minmax(0,1fr) clamp(230px,20vw,300px)!important}' +
    '.app.hr{grid-template-columns:clamp(210px,17vw,280px) minmax(0,1fr)!important}' +
    '.app.hl.hr{grid-template-columns:minmax(0,1fr)!important}' +
    '.app.hl>#left,.app.hr>#right{display:none}' +
    '.dsp{display:inline-flex;gap:4px;margin-left:auto;align-items:center}' +
    '.dsp .btn{white-space:nowrap}'

  // Was the page fitted to the window before our narrower panels change its size?
  // (evaluated after the helpers below are defined — see the call before apply(false))

  // The pages keep their zoom state private, so read it from the screen: the page counts as
  // "fitted" when it fills the canvas on one axis (leaving the usual margin), and refitting is
  // a click on the page's own Fit button.
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

  var initialFit = wasFitted()   // measure first, then change the layout
  document.head.appendChild(css)

  function apply(wasFit) {
    app.classList.toggle('hl', !!st.l); app.classList.toggle('hr', !!st.r)
    bl.classList.toggle('on', !!st.l); br.classList.toggle('on', !!st.r); bc.classList.toggle('on', !!st.l && !!st.r)
    try { localStorage.setItem(KEY, JSON.stringify(st)) } catch (e) { /* storage blocked */ }
    refit(wasFit)
  }
  function mk(label, title) { var b = document.createElement('button'); b.className = 'btn sm'; b.textContent = label; b.title = title; b.type = 'button'; return b }
  var bl = mk('◧ Panel', 'Hide / show the left panel'), br = mk('Inspector ◨', 'Hide / show the inspector'), bc = mk('⤢ Canvas only', 'Hide both panels for the biggest workspace')
  bl.onclick = function () { var f = wasFitted(); st.l = !st.l; apply(f) }
  br.onclick = function () { var f = wasFitted(); st.r = !st.r; apply(f) }
  bc.onclick = function () { var f = wasFitted(); var both = st.l && st.r; st.l = st.r = !both; apply(f) }
  var wrap = document.createElement('span'); wrap.className = 'dsp'
  wrap.appendChild(bl); wrap.appendChild(bc); wrap.appendChild(br)
  header.appendChild(wrap)

  // Keep a fitted page fitted when the window (or browser zoom) changes.
  var last = scroller.clientWidth + 'x' + scroller.clientHeight
  if (window.ResizeObserver) new ResizeObserver(function () {
    var now = scroller.clientWidth + 'x' + scroller.clientHeight
    if (now !== last) { last = now; if (wasFittedBefore) refit(true) }
  }).observe(scroller)
  // wasFitted() can't be evaluated after the size already changed, so remember it after each fit-relevant moment.
  var wasFittedBefore = true
  setInterval(function () { var s = scroller.clientWidth + 'x' + scroller.clientHeight; if (s === last) wasFittedBefore = wasFitted() }, 500)

  apply(initialFit)
})()
