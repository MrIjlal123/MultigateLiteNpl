interface Env {
  ASSETS: Fetcher
  FRONTEND_ORIGIN: string
}

interface LoginRequest {
  username?: string
  password?: string
}

const LOGIN_URL = 'https://ptosm.api.pelindo.co.id/auth/loginRDS'
const INTEGRATION_API = 'https://dev-ptosm-api.ilcs.co.id'

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  })
  const origin = request.headers.get('Origin')

  if (origin && origin === env.FRONTEND_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN)
  }

  return headers
}

function jsonError(request: Request, env: Env, message: string, status: number): Response {
  return Response.json(
    { message },
    { status, headers: corsHeaders(request, env) },
  )
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const headers = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return new Response('Method Not Allowed', { status: 405, headers })
  }

  let body: LoginRequest
  try {
    body = (await request.json()) as LoginRequest
  } catch {
    return jsonError(request, env, 'Body request harus berupa JSON yang valid.', 400)
  }

  try {
    const upstream = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const responseHeaders = corsHeaders(request, env)
    responseHeaders.set(
      'Content-Type',
      upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
    )

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return jsonError(request, env, 'Tidak dapat terhubung ke server autentikasi.', 502)
  }
}

async function proxyIntegration(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, INTEGRATION_API)
  const headers = new Headers()

  for (const name of ['accept', 'authorization', 'content-type']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer(),
    })
    const responseHeaders = new Headers()
    const contentType = upstream.headers.get('Content-Type')
    if (contentType) responseHeaders.set('Content-Type', contentType)

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return Response.json(
      { message: 'Tidak dapat terhubung ke server integrasi.' },
      { status: 502 },
    )
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.pathname === '/auth/loginRDS') {
      return handleLogin(request, env)
    }
    if (url.pathname.startsWith('/integrasi/npl/')) {
      return proxyIntegration(request)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
