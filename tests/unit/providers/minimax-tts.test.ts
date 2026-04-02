import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

import { synthesizeWithMinimaxTTS } from '@/lib/providers/minimax/tts'

function makeSuccessResponse(hexAudio: string) {
  return {
    ok: true,
    json: async () => ({
      data: { audio: hexAudio },
      base_resp: { status_code: 0, status_msg: 'success' },
    }),
  }
}

function makeApiErrorResponse(statusCode: number, statusMsg: string) {
  return {
    ok: true,
    json: async () => ({
      data: {},
      base_resp: { status_code: statusCode, status_msg: statusMsg },
    }),
  }
}

function makeHttpErrorResponse(status: number) {
  return {
    ok: false,
    status,
    text: async () => 'Unauthorized',
  }
}

describe('minimax tts provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls t2a_v2 endpoint with correct params and returns audio buffer', async () => {
    const hexAudio = Buffer.from('mp3-data').toString('hex')
    fetchMock.mockResolvedValue(makeSuccessResponse(hexAudio))

    const result = await synthesizeWithMinimaxTTS(
      { text: '你好', voiceId: 'male-qn-qingse', modelId: 'speech-01-turbo' },
      'test-api-key',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimaxi.com/v1/t2a_v2',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('speech-01-turbo')
    expect(body.text).toBe('你好')
    expect(body.voice_setting.voice_id).toBe('male-qn-qingse')

    expect(result.success).toBe(true)
    expect(result.audioData).toBeInstanceOf(Buffer)
    expect(result.audioData?.toString()).toBe('mp3-data')
  })

  it('returns error when API returns non-zero status_code', async () => {
    fetchMock.mockResolvedValue(makeApiErrorResponse(1002, 'invalid voice_id'))

    const result = await synthesizeWithMinimaxTTS(
      { text: 'test', voiceId: 'bad-voice', modelId: 'speech-01-turbo' },
      'test-api-key',
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('invalid voice_id')
  })

  it('returns error on HTTP failure', async () => {
    fetchMock.mockResolvedValue(makeHttpErrorResponse(401))

    const result = await synthesizeWithMinimaxTTS(
      { text: 'test', voiceId: 'male-qn-qingse', modelId: 'speech-01-turbo' },
      'bad-key',
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('401')
  })

  it('returns error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network timeout'))

    const result = await synthesizeWithMinimaxTTS(
      { text: 'test', voiceId: 'male-qn-qingse', modelId: 'speech-01-turbo' },
      'test-api-key',
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network timeout')
  })
})
