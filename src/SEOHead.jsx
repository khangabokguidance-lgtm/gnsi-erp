import { useEffect } from 'react'

export default function SEOHead() {
  useEffect(() => {
    // ── Title ──
    document.title = 'GNSI Portal — Guidance Navodaya & Sainik Institute, Khangabok'

    const setMeta = (name, content, prop = false) => {
      const attr = prop ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el) }
      el.setAttribute('content', content)
    }

    // ── Basic SEO ──
    setMeta('description', 'Guidance Navodaya & Sainik Institute, Khangabok — Manipur\'s #1 coaching centre for Navodaya, Sainik School, and RMS entrance exam preparation. 10+ years, 95% selection rate, safe hostel.')
    setMeta('keywords', 'Navodaya coaching Manipur, Sainik School coaching Khangabok, NVS coaching Thoubal, GNSI Portal, Guidance institute Manipur, RMS coaching Manipur')
    setMeta('author', 'Guidance Navodaya & Sainik Institute')
    setMeta('robots', 'index, follow')
    setMeta('viewport', 'width=device-width, initial-scale=1.0')
    setMeta('theme-color', '#0B1E3D')

    // ── Open Graph (Facebook, WhatsApp) ──
    setMeta('og:title', 'GNSI — Guidance Navodaya & Sainik Institute, Khangabok', true)
    setMeta('og:description', 'Manipur\'s #1 coaching institute for Navodaya, Sainik School & RMS. 10+ years, 95% selection rate, safe hostel facility.', true)
    setMeta('og:type', 'website', true)
    setMeta('og:url', 'https://www.guidancekhangabok.in', true)
    setMeta('og:image', 'https://www.guidancekhangabok.in/og-image.png', true)
    setMeta('og:image:width', '1200', true)
    setMeta('og:image:height', '630', true)
    setMeta('og:site_name', 'GNSI Portal', true)
    setMeta('og:locale', 'en_IN', true)

    // ── Twitter Card ──
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', 'GNSI — Guidance Navodaya & Sainik Institute')
    setMeta('twitter:description', 'Manipur\'s #1 coaching institute for Navodaya & Sainik School entrance exams.')
    setMeta('twitter:image', 'https://www.guidancekhangabok.in/og-image.png')

    // ── Canonical ──
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    canonical.href = 'https://www.guidancekhangabok.in'

    // ── Favicon ──
    const setFavicon = (href, type = 'image/png', sizes = '') => {
      let link = document.querySelector(`link[rel="icon"][sizes="${sizes}"]`) || document.createElement('link')
      link.rel = 'icon'; link.type = type; link.href = href
      if (sizes) link.sizes = sizes
      document.head.appendChild(link)
    }
    setFavicon('/favicon.ico', 'image/x-icon')
    setFavicon('/favicon-32x32.png', 'image/png', '32x32')
    setFavicon('/favicon-16x16.png', 'image/png', '16x16')

    // ── Apple touch icon ──
    let apple = document.querySelector('link[rel="apple-touch-icon"]')
    if (!apple) { apple = document.createElement('link'); apple.rel = 'apple-touch-icon'; document.head.appendChild(apple) }
    apple.href = '/apple-touch-icon.png'

    // ── Structured data (JSON-LD) ──
    let ld = document.querySelector('#gnsi-jsonld')
    if (!ld) { ld = document.createElement('script'); ld.id = 'gnsi-jsonld'; ld.type = 'application/ld+json'; document.head.appendChild(ld) }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      "name": "Guidance Navodaya & Sainik Institute",
      "alternateName": "GNSI Khangabok",
      "url": "https://www.guidancekhangabok.in",
      "logo": "https://www.guidancekhangabok.in/og-image.png",
      "description": "Manipur's premier coaching institute for Navodaya, Sainik School, and RMS entrance examinations.",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Khangabok Sorok Wangma, Near Community Hall",
        "addressLocality": "Thoubal",
        "addressRegion": "Manipur",
        "postalCode": "795138",
        "addressCountry": "IN"
      },
      "telephone": "+91-8974298074",
      "foundingDate": "2016",
      "areaServed": "Manipur, India",
      "sameAs": ["https://guidancekhangabok.in"]
    })

    // ── Google Analytics ──
    const GA_ID = 'G-BP4H87DL1F' // Replace with your real GA4 ID
    if (GA_ID !== 'G-BP4H87DL1F' && !document.querySelector('#ga-script')) {
      const gaScript = document.createElement('script')
      gaScript.id = 'ga-script'
      gaScript.async = true
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
      document.head.appendChild(gaScript)
      const gaInit = document.createElement('script')
      gaInit.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`
      document.head.appendChild(gaInit)
    }

    // ── PWA manifest ──
    let manifest = document.querySelector('link[rel="manifest"]')
    if (!manifest) { manifest = document.createElement('link'); manifest.rel = 'manifest'; document.head.appendChild(manifest) }
    manifest.href = '/manifest.json'
  }, [])

  return null
}