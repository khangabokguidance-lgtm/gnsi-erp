// supabase/functions/upload-pending-document/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Same R2 upload pattern as the (already-designed) upload-document function
// for real admissions, but keyed to a pending_app_id (uuid) instead of a
// gcc_no, since no GCC number exists until staff approves the application.
//
// On approval (see the "Pending Applications" review queue in Admissions.jsx),
// these rows get copied into application_documents with the new gcc_no — the
// R2 object itself doesn't need to move, only the metadata row pointing to it.
//
// Deploy:
//   supabase functions deploy upload-pending-document --no-verify-jwt
// Secrets: same R2_* secrets as upload-document (R2_ACCOUNT_ID,
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) — reuse, don't duplicate.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = 'gnsi-documents'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
const ALLOWED_DOC_TYPES = [
  'Photo', 'Birth Certificate', 'Aadhaar Card', 'Mark Sheet',
  'Transfer Certificate', 'Caste Certificate', 'Address Proof',
]

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const pendingAppId = formData.get('pending_app_id') as string | null
    const docType = formData.get('doc_type') as string | null

    if (!file || !pendingAppId || !docType) {
      return new Response(JSON.stringify({ error: 'file, pending_app_id, and doc_type are required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return new Response(JSON.stringify({ error: 'Invalid document type' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (file.size > MAX_FILE_BYTES) {
      return new Response(JSON.stringify({ error: `File exceeds ${MAX_FILE_BYTES / 1e6}MB limit` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Only PDF, JPG, and PNG files are accepted' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Confirm the pending application actually exists and is still in draft —
    // don't let someone upload documents against an application that's
    // already been approved/rejected/long abandoned.
    const { data: pendingApp, error: appErr } = await supabase
      .from('pending_applications')
      .select('id, status')
      .eq('id', pendingAppId)
      .maybeSingle()

    if (appErr || !pendingApp) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (!['draft', 'submitted', 'payment_pending'].includes(pendingApp.status)) {
      return new Response(JSON.stringify({ error: 'This application is no longer accepting document uploads' }), {
        status: 409, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const safeDocType = docType.replace(/[^a-zA-Z0-9]/g, '_')
    const r2Key = `pending-applications/${pendingAppId}/${safeDocType}_${crypto.randomUUID()}.${ext}`

    const buffer = await file.arrayBuffer()
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2Key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
    }))

    const { data: docRow, error: docErr } = await supabase
      .from('pending_application_documents')
      .insert([{
        pending_app_id: pendingAppId,
        doc_type: docType,
        r2_key: r2Key,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }])
      .select()
      .single()

    if (docErr) {
      console.error('upload-pending-document: db insert failed after R2 upload succeeded', docErr)
      return new Response(JSON.stringify({ error: 'Upload saved but metadata failed — contact support' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, document_id: docRow.id, doc_type: docType }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('upload-pending-document error:', err)
    return new Response(JSON.stringify({ error: 'Internal error uploading document' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
