// Browser client + UI for registry.aauth.dev.
//
// The page is an AAuth web-agent. It bootstraps an agent token (signed
// sig=hwk with a key held in IndexedDB), lists resources (sig=jwt with the
// agent token), and — to add a resource — runs the auth-token flow against
// the person's Person Server (Hellō): the registry challenges, the human
// approves at the PS (the interaction), and the resulting auth_token proves
// a verified identity. Bundled to public/registry.js by `npm run build:client`.

import { fetch as sigFetch } from '@hellocoop/httpsig'

const ORIGIN = location.origin
const PS_DEFAULT = 'https://person.hello.coop'
const AGENT_TOKEN_KEY = 'registry-agent-token'

// ── Key management (durable Ed25519 key in IndexedDB) ──

const DB_NAME = 'registry-agent'
const STORE = 'keys'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const rq = tx.objectStore(STORE).get(key)
    rq.onsuccess = () => resolve(rq.result ?? null)
    rq.onerror = () => reject(rq.error)
  })
}

async function idbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let keyPairPromise = null
function getKeyPair() {
  if (!keyPairPromise) {
    keyPairPromise = (async () => {
      let kp = await idbGet('agent')
      if (!kp) {
        kp = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])
        await idbPut('agent', kp)
      }
      return kp
    })()
  }
  return keyPairPromise
}

const getAgentToken = () => localStorage.getItem(AGENT_TOKEN_KEY)
const setAgentToken = (t) => localStorage.setItem(AGENT_TOKEN_KEY, t)

// ── Signed fetch helpers ──

async function publicJwk(kp) {
  return crypto.subtle.exportKey('jwk', kp.publicKey)
}

// sig=jwt call (agent_token or auth_token), with optional body + headers.
async function signedFetch(url, { method = 'GET', body, jwt, headers = {} } = {}) {
  const kp = await getKeyPair()
  const pub = await publicJwk(kp)
  const hasBody = body != null
  const components = hasBody
    ? ['@method', '@authority', '@path', 'content-type', 'signature-key']
    : ['@method', '@authority', '@path', 'signature-key']
  // sigFetch returns a plain Response unless returnSent is set.
  return sigFetch(url, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: hasBody ? body : undefined,
    signingKey: pub,
    signingCryptoKey: kp.privateKey,
    signatureKey: { type: 'jwt', jwt },
    components,
  })
}

// POST /bootstrap signed sig=hwk → mint + store an agent token.
async function bootstrap() {
  const kp = await getKeyPair()
  const pub = await publicJwk(kp)
  const response = await sigFetch(`${ORIGIN}/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ps: PS_DEFAULT }),
    signingKey: pub,
    signingCryptoKey: kp.privateKey,
    signatureKey: { type: 'hwk' },
    components: ['@method', '@authority', '@path', 'content-type', 'signature-key'],
  })
  const data = await response.json()
  if (!response.ok || !data.agent_token) throw new Error(data.error || 'bootstrap failed')
  setAgentToken(data.agent_token)
  return data.agent_token
}

async function ensureAgentToken() {
  return getAgentToken() || (await bootstrap())
}


// ── Auth-token flow (login / consent) via same-page redirect ──
//
// When the PS defers for consent, we redirect THIS page to Hellō (setting
// window.location) rather than opening a tab. Before leaving we persist the
// pending state; the signing key (IndexedDB) and agent token (localStorage)
// already survive the navigation. On return, resumePending() polls the PS
// for the auth_token and finishes the action.

const PENDING_KEY = 'registry-pending'
const savePending = (p) => localStorage.setItem(PENDING_KEY, JSON.stringify(p))
const clearPending = () => localStorage.removeItem(PENDING_KEY)
function loadPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
  } catch {
    return null
  }
}

function parseRequirement(h) {
  const out = {}
  ;(h || '').split(';').forEach((part) => {
    const m = part.trim().match(/^([a-z0-9-]+)=(?:"([^"]*)"|(\S+))$/i)
    if (m) out[m[1].toLowerCase()] = m[2] ?? m[3]
  })
  return out
}

// Begin the auth-token flow. Returns { authToken } if consent was cached
// (the PS answered 200). If consent is needed (202), saves `pending` plus
// the poll URL and redirects this page to Hellō — returns { redirecting:true }
// and the caller should stop (the page is navigating away).
async function startAuthFlow(pending) {
  const agentToken = await ensureAgentToken()

  const res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: agentToken })
  if (res.status !== 401) throw new Error(`unexpected ${res.status} from identity`)
  const resourceToken = parseRequirement(res.headers.get('aauth-requirement'))['resource-token']
  if (!resourceToken) throw new Error('no resource_token in challenge')

  const psMeta = await (await fetch(`${PS_DEFAULT}/.well-known/aauth-person.json`)).json()
  const psRes = await signedFetch(psMeta.token_endpoint, {
    method: 'POST',
    jwt: agentToken,
    body: JSON.stringify({ resource_token: resourceToken, capabilities: ['interaction'], prompt: 'consent' }),
  })

  if (psRes.status === 200) {
    const body = await psRes.json()
    if (!body.auth_token) throw new Error('PS returned no auth_token')
    return { authToken: body.auth_token }
  }
  if (psRes.status !== 202) throw new Error(`PS token endpoint ${psRes.status}`)

  const body = await psRes.json().catch(() => ({}))
  const req = parseRequirement(psRes.headers.get('aauth-requirement'))
  const interactionUrl = req.url || body.url || psMeta.interaction_endpoint
  const code = req.code || body.code
  const pollUrl = new URL(psRes.headers.get('location') || body.location, PS_DEFAULT).toString()

  savePending({ ...pending, pollUrl })
  // Redirect this page to Hellō; the PS sends us back to ORIGIN/ after approval.
  window.location.href = `${interactionUrl}?code=${encodeURIComponent(code)}&callback=${encodeURIComponent(ORIGIN + '/')}`
  return { redirecting: true }
}

async function pollForAuthToken(pollUrl, agentToken, maxCycles = 40) {
  for (let i = 0; i < maxCycles; i++) {
    const res = await signedFetch(pollUrl, { jwt: agentToken, headers: { Prefer: 'wait=30' } })
    if (res.status === 200) {
      const body = await res.json()
      if (body.auth_token) return body.auth_token
    } else if (res.status === 403 || res.status === 404 || res.status === 408) {
      throw new Error(`consent ${res.status}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('sign-in timed out')
}

// Finish an action with a verified auth_token.
async function completeWithAuthToken(authToken, pending) {
  if (pending.kind === 'add') {
    const res = await signedFetch(`${ORIGIN}/resources`, {
      method: 'POST',
      jwt: authToken,
      body: JSON.stringify({ issuer: pending.issuer }),
    })
    return { status: res.status, data: await res.json().catch(() => ({})) }
  }
  // login: hand the auth_token to the registry so it sets the session cookie.
  const res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: authToken })
  if (!res.ok) throw new Error(`login retry ${res.status}`)
  return res.json()
}

// On load, if we're returning from a Hellō redirect, finish the flow.
async function resumePending() {
  const pending = loadPending()
  if (!pending) return false
  clearPending()
  $('status').innerHTML = '<span class="who">Finishing sign-in…</span>'
  $('resources').innerHTML = ''
  try {
    const agentToken = getAgentToken()
    if (!agentToken) throw new Error('agent token missing after redirect')
    const authToken = await pollForAuthToken(pending.pollUrl, agentToken)
    await completeWithAuthToken(authToken, pending)
  } catch (err) {
    console.error('resume failed', err)
  }
  return true
}

// ── Registry API ──

async function listResources() {
  const agentToken = await ensureAgentToken()
  const res = await signedFetch(`${ORIGIN}/resources`, { jwt: agentToken })
  if (!res.ok) throw new Error(`list ${res.status}`)
  return res.json()
}

// Add a resource. With a session it succeeds directly; if the registry
// challenges for identity, startAuthFlow redirects to Hellō (and the add is
// retried on return). Returns { status, data } or { redirecting:true }.
async function addResource(issuer) {
  const agentToken = await ensureAgentToken()
  const res = await signedFetch(`${ORIGIN}/resources`, {
    method: 'POST',
    jwt: agentToken,
    body: JSON.stringify({ issuer }),
  })
  if (res.status === 401 && res.headers.get('aauth-requirement')) {
    const r = await startAuthFlow({ kind: 'add', issuer })
    if (r.redirecting) return { redirecting: true }
    return completeWithAuthToken(r.authToken, { kind: 'add', issuer })
  }
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const getSession = () => fetch(`${ORIGIN}/auth/session`).then((r) => r.json())
const logout = () => fetch(`${ORIGIN}/auth/logout`, { method: 'POST' }).then(() => {})

// ── UI ──

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function renderResources(index) {
  const list = $('resources')
  const items = index.resources || []
  if (!items.length) {
    list.innerHTML = '<p class="muted">No resources yet. Be the first to add one.</p>'
    return
  }
  list.innerHTML = items
    .map(
      (r) => `
    <div class="card">
      <div class="card-head">
        <a class="name" href="${esc(r.issuer)}" target="_blank" rel="noopener">${esc(r.name)}</a>
        <span class="badge">${esc(r.access_mode)}</span>
      </div>
      <p class="desc">${esc(r.description)}</p>
      <div class="host">${esc(r.issuer)}</div>
    </div>`,
    )
    .join('')
}

function setStatus(session) {
  const bar = $('status')
  if (session && session.logged_in) {
    const who = session.name || session.email || session.sub
    bar.innerHTML = `<span class="who">Signed in as <b>${esc(who)}</b>${session.email ? ` (${esc(session.email)})` : ''}</span> <button id="logout" class="link">Log out</button>`
    $('logout').onclick = async () => {
      await logout()
      refresh()
    }
  } else {
    bar.innerHTML = `<button id="login" class="btn">ō&nbsp; Log in with Hellō</button>`
    $('login').onclick = doLogin
  }
}

async function doLogin() {
  $('login').disabled = true
  $('login').textContent = 'Connecting to Hellō…'
  try {
    const r = await startAuthFlow({ kind: 'login' })
    if (r.redirecting) return // page is navigating to Hellō
    await completeWithAuthToken(r.authToken, { kind: 'login' })
    await refresh()
  } catch (err) {
    alert(`Login failed: ${err.message}`)
    refresh()
  }
}

async function doAdd() {
  const input = $('issuer')
  const issuer = input.value.trim()
  if (!issuer) return
  const btn = $('add-btn')
  btn.disabled = true
  $('add-result').textContent = 'Adding…'
  try {
    const out = await addResource(issuer)
    if (out.redirecting) return // navigating to Hellō; resumed on return
    const { status, data } = out
    if (status === 201) $('add-result').textContent = `✓ Added ${data.resource?.name || issuer}`
    else if (status === 200) $('add-result').textContent = `Already in the registry.`
    else $('add-result').textContent = `Couldn't add: ${(data.errors || [data.error]).join(', ')}`
    input.value = ''
    await refresh()
  } catch (err) {
    $('add-result').textContent = `Error: ${err.message}`
  } finally {
    btn.disabled = false
  }
}

async function refresh() {
  // On load, only check the session (a plain cookie read — no agent, no
  // bootstrap, no signed calls). Nothing AAuth happens until the person
  // clicks "Log in with Hellō". Resources are shown only once signed in.
  let session
  try {
    session = await getSession()
  } catch {
    session = { logged_in: false }
  }
  setStatus(session)
  const loggedIn = !!(session && session.logged_in)
  $('add-section').classList.toggle('hidden', !loggedIn)

  if (!loggedIn) {
    $('resources').innerHTML = '<p class="muted">Log in to browse the registry.</p>'
    return
  }
  try {
    const index = await listResources()
    renderResources(index)
  } catch (err) {
    $('resources').innerHTML = `<p class="muted">Couldn't load: ${esc(err.message)}</p>`
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  $('add-btn').onclick = doAdd
  $('issuer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doAdd()
  })
  await resumePending() // finish a redirect-based sign-in, if returning
  refresh()
})
