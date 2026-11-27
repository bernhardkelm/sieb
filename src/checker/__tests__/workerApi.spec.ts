// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { CLAIM } from '#checker/__tests__/checkFixtures.ts'
import { InvalidClaimError } from '#checker/api/parseClaim.ts'
import { createWorkerApi, WorkerApiError } from '#checker/api/workerApi.ts'

/**
 * Creates the client with a fake fetch that answers with the given response.
 * @param {Response} response - Answer of every request
 * @returns {{ api: ReturnType<typeof createWorkerApi>, fetch: ReturnType<typeof vi.fn> }} - Client and fetch mock
 */
const setup = (response: Response) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response)
  const api = createWorkerApi({ baseUrl: 'http://sieb:3101', secret: 'worker-secret', fetch })

  return { api, fetch }
}

describe('createWorkerApi', () => {
  it('claims with the worker secret as bearer token', async () => {
    const { api, fetch } = setup(Response.json(CLAIM))

    expect(await api.claim()).toEqual(CLAIM)
    expect(await setup(Response.json({ ...CLAIM, imageDigest: undefined })).api.claim()).toEqual(
      CLAIM,
    )
    expect(fetch).toHaveBeenCalledWith(
      'http://sieb:3101/worker/claim',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer worker-secret' }),
      }),
    )
  })

  it('returns null for an empty queue and throws on other answers', async () => {
    expect(await setup(new Response(null, { status: 204 })).api.claim()).toBeNull()
    await expect(setup(new Response(null, { status: 401 })).api.claim()).rejects.toBeInstanceOf(
      WorkerApiError,
    )
  })

  it('rejects claims whose values could reach a command line unchecked', async () => {
    const flag = setup(Response.json({ ...CLAIM, imageRef: '--insecure' })).api.claim()
    const header = setup(Response.json({ ...CLAIM, token: 'a\nb' })).api.claim()
    const missing = setup(Response.json({ ...CLAIM, checkId: 'x' })).api.claim()

    await expect(flag).rejects.toMatchObject({ message: 'invalid claim: imageRef', checkId: 7 })
    await expect(header).rejects.toMatchObject({ message: 'invalid claim: token' })
    await expect(missing).rejects.toBeInstanceOf(InvalidClaimError)
    await expect(missing).rejects.toMatchObject({ checkId: null })
  })

  it('maps a 409 heartbeat to abort and posts the phase', async () => {
    const { api, fetch } = setup(new Response(null, { status: 409 }))

    expect(await api.heartbeat(7, { phase: 'investigating' })).toBe('abort')
    expect(fetch).toHaveBeenCalledWith(
      'http://sieb:3101/worker/checks/7/heartbeat',
      expect.objectContaining({ body: '{"phase":"investigating"}' }),
    )
    expect(
      await setup(new Response(null, { status: 204 })).api.heartbeat(7, { phase: 'preparing' }),
    ).toBe('ok')
  })

  it('posts the result and accepts a 409 for an already closed check', async () => {
    const result = { status: 'done' as const, error: null, durationMs: 1, usage: null, reply: null }

    await expect(
      setup(new Response(null, { status: 204 })).api.result(7, result),
    ).resolves.toBeUndefined()
    await expect(
      setup(new Response(null, { status: 409 })).api.result(7, result),
    ).resolves.toBeUndefined()
    await expect(setup(new Response(null, { status: 500 })).api.result(7, result)).rejects.toThrow(
      '500',
    )
  })

  it('maps a 404 heartbeat to abort, the check no longer exists', async () => {
    expect(
      await setup(new Response(null, { status: 404 })).api.heartbeat(7, { phase: 'preparing' }),
    ).toBe('abort')
    await expect(
      setup(new Response(null, { status: 500 })).api.heartbeat(7, { phase: 'preparing' }),
    ).rejects.toThrow('500')
  })

  it('fails a 200 claim that is no JSON with the check id it names', async () => {
    const named = setup(new Response('{"checkId": 12, "prompt": "cut', { status: 200 })).api.claim()
    const anonymous = setup(new Response('<html>proxy error</html>', { status: 200 })).api.claim()

    await expect(named).rejects.toMatchObject({
      message: 'invalid claim: body is no JSON',
      checkId: 12,
    })
    await expect(anonymous).rejects.toMatchObject({ checkId: null })
  })
})
