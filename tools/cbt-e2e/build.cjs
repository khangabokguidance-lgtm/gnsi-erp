// Bundles the real candidate page (src/CbtPublic.jsx) for the end-to-end test, with the Supabase client swapped for supabase-stub.js.
// Run from the repo root:  node tools/cbt-e2e/build.cjs      (writes <tmp>/cbt-e2e/e2e.js and e2e.html)
const path = require('path')
const fs = require('fs')
const os = require('os')
const esbuild = require('esbuild')
const out = path.join(os.tmpdir(), 'cbt-e2e')
fs.mkdirSync(out, { recursive: true })
const root = path.resolve(__dirname, '..', '..')
fs.writeFileSync(path.join(out, 'entry.jsx'),
  `import React from 'react'\nimport { createRoot } from 'react-dom/client'\nimport CbtPublic from ${JSON.stringify(path.join(root, 'src/CbtPublic.jsx'))}\ncreateRoot(document.getElementById('root')).render(<CbtPublic />)\n`)
fs.writeFileSync(path.join(out, 'e2e.html'), '<!doctype html>\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<div id="root"></div>\n<script src="e2e.js"></script>\n')
esbuild.build({
  entryPoints: [path.join(out, 'entry.jsx')], bundle: true, outfile: path.join(out, 'e2e.js'), loader: { '.js': 'jsx', '.jsx': 'jsx' }, jsx: 'automatic',
  nodePaths: [path.join(root, 'node_modules')], logLevel: 'error', define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'stub-supabase', setup(b) { b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(__dirname, 'supabase-stub.js') })) } }],
}).then(() => console.log('built ->', out)).catch(() => process.exit(1))
