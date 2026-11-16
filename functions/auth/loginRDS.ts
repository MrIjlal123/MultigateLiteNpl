interface Env {
  FRONTEND_ORIGIN: string
}

interface LoginRequest {
  username?: string
  password?: string
}

const API_URL = 'https://ptosm.api.pelindo.co.id/auth/loginRDS'

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  })
  const requestOrigin = request.headers.get('Origin')

  if (requestOrigin && requestOrigin === env.FRONTEND_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN)
  }

  return headers
}

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  new Response(null, { status: 204, headers: corsHeaders(request, env) })

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let requestBody: LoginRequest

  try {
    requestBody = (await request.json()) as LoginRequest
  } catch {
    return Response.json(
      { message: 'Body request harus berupa JSON yang valid.' },
      { status: 400, headers: corsHeaders(request, env) },
    )
  }

  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const headers = corsHeaders(request, env)
    headers.set(
      'Content-Type',
      upstream.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
    )

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  } catch {
    return Response.json(
      { message: 'Tidak dapat terhubung ke server autentikasi.' },
      { status: 502, headers: corsHeaders(request, env) },
    )
  }
}
