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

// ── Auth-token flow (login / consent) ──

function parseRequirement(h) {
  const out = {}
  ;(h || '').split(';').forEach((part) => {
    const m = part.trim().match(/^([a-z0-9-]+)=(?:"([^"]*)"|(\S+))$/i)
    if (m) out[m[1].toLowerCase()] = m[2] ?? m[3]
  })
  return out
}

// Run the full auth-token flow, invoking onConsent(interaction) if the PS
// defers for human approval. Resolves to an auth_token (verified identity).
async function getAuthToken(onConsent) {
  const agentToken = await ensureAgentToken()

  // 1. Challenge from the registry → resource_token.
  let res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: agentToken })
  if (res.status !== 401) throw new Error(`unexpected ${res.status} from identity`)
  const challenge = parseRequirement(res.headers.get('aauth-requirement'))
  const resourceToken = challenge['resource-token']
  if (!resourceToken) throw new Error('no resource_token in challenge')

  // 2. Exchange at the PS token endpoint.
  const psMeta = await (await fetch(`${PS_DEFAULT}/.well-known/aauth-person.json`)).json()
  const psRes = await signedFetch(psMeta.token_endpoint, {
    method: 'POST',
    jwt: agentToken,
    body: JSON.stringify({ resource_token: resourceToken, capabilities: ['interaction'], prompt: 'consent' }),
  })

  if (psRes.status === 200) {
    const body = await psRes.json()
    if (!body.auth_token) throw new Error('PS returned no auth_token')
    return body.auth_token
  }
  if (psRes.status !== 202) throw new Error(`PS token endpoint ${psRes.status}`)

  // 3. Deferred → human approves at the PS (the interaction). Poll.
  const body = await psRes.json().catch(() => ({}))
  const req = parseRequirement(psRes.headers.get('aauth-requirement'))
  const interaction = {
    url: req.url || body.url || psMeta.interaction_endpoint,
    code: req.code || body.code,
  }
  const pollUrl = psRes.headers.get('location') || body.location
  if (onConsent) onConsent(interaction)
  return pollForAuthToken(new URL(pollUrl, PS_DEFAULT).toString(), agentToken)
}

async function pollForAuthToken(pollUrl, agentToken) {
  for (;;) {
    const res = await signedFetch(pollUrl, { jwt: agentToken, headers: { Prefer: 'wait=30' } })
    if (res.status === 200) {
      const body = await res.json()
      if (body.auth_token) return body.auth_token
    } else if (res.status === 403 || res.status === 404 || res.status === 408) {
      throw new Error(`consent ${res.status}`)
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

// Establish a session: complete the auth-token flow, then hand the
// auth_token to the registry so it sets the session cookie. Returns claims.
async function login(onConsent) {
  const authToken = await getAuthToken(onConsent)
  const res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: authToken })
  if (!res.ok) throw new Error(`login retry ${res.status}`)
  return res.json()
}

// ── Registry API ──

async function listResources() {
  const agentToken = await ensureAgentToken()
  const res = await signedFetch(`${ORIGIN}/resources`, { jwt: agentToken })
  if (!res.ok) throw new Error(`list ${res.status}`)
  return res.json()
}

// Add a resource. Uses the session if present; if the registry challenges
// for identity, completes the auth-token flow and retries with it.
async function addResource(issuer, onConsent) {
  const agentToken = await ensureAgentToken()
  let res = await signedFetch(`${ORIGIN}/resources`, {
    method: 'POST',
    jwt: agentToken,
    body: JSON.stringify({ issuer }),
  })
  if (res.status === 401 && res.headers.get('aauth-requirement')) {
    const authToken = await getAuthToken(onConsent)
    res = await signedFetch(`${ORIGIN}/resources`, {
      method: 'POST',
      jwt: authToken,
      body: JSON.stringify({ issuer }),
    })
  }
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
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
    $('add-section').classList.remove('hidden')
  } else {
    bar.innerHTML = `<button id="login" class="btn">ō&nbsp; Log in with Hellō</button>`
    $('login').onclick = doLogin
    $('add-section').classList.add('hidden')
  }
}

function showConsent(interaction) {
  // No callback param: we poll in this tab, so we don't want the PS to
  // redirect the approval tab back to a fresh registry page. Approve in the
  // new tab, then return here — polling completes the sign-in.
  const url = `${interaction.url}?code=${encodeURIComponent(interaction.code)}`
  $('consent').innerHTML = `
    <div class="consent-box">
      <p>Approve at your Person Server to continue:</p>
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">ō&nbsp; Continue with Hellō</a>
      <p class="muted small">Opens a new tab — approve there, then come back. Waiting for approval…</p>
    </div>`
  $('consent').classList.remove('hidden')
}

function clearConsent() {
  $('consent').classList.add('hidden')
  $('consent').innerHTML = ''
}

async function doLogin() {
  $('login').disabled = true
  $('login').textContent = 'Signing in…'
  try {
    await login(showConsent)
    clearConsent()
    await refresh()
  } catch (err) {
    clearConsent()
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
    const { status, data } = await addResource(issuer, showConsent)
    clearConsent()
    if (status === 201) $('add-result').textContent = `✓ Added ${data.resource?.name || issuer}`
    else if (status === 200) $('add-result').textContent = `Already in the registry.`
    else $('add-result').textContent = `Couldn't add: ${(data.errors || [data.error]).join(', ')}`
    input.value = ''
    await refresh()
  } catch (err) {
    clearConsent()
    $('add-result').textContent = `Error: ${err.message}`
  } finally {
    btn.disabled = false
  }
}

async function refresh() {
  try {
    const [session, index] = await Promise.all([getSession(), listResources()])
    setStatus(session)
    renderResources(index)
  } catch (err) {
    $('resources').innerHTML = `<p class="muted">Couldn't load: ${esc(err.message)}</p>`
  }
}

window.addEventListener('DOMContentLoaded', () => {
  $('add-btn').onclick = doAdd
  $('issuer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doAdd()
  })
  refresh()
})
