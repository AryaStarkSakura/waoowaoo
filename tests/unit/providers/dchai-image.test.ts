import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

const getProviderConfigMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

import { DcHaiImageGenerator } from '@/lib/generators/image/dchai'

const MOCK_PROVIDER_CONFIG = {
  id: 'dchai',
  name: 'DcHai',
  apiKey: 'test-dchai-key',
  baseUrl: 'https://sg2.dchai.cn/v1',
}

function makeChatResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    }),
  }
}

describe('dchai image generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProviderConfigMock.mockResolvedValue(MOCK_PROVIDER_CONFIG)
  })

  it('calls chat completions endpoint and extracts image URL from markdown', async () => {
    const imageUrl = 'https://example.com/image.jpeg'
    fetchMock.mockResolvedValue(makeChatResponse(`![image](${imageUrl})`))

    const generator = new DcHaiImageGenerator('Nano_Banana_Pro_2K_0')
    const result = await generator.generate({ userId: 'user-1', prompt: '夕阳美景' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sg2.dchai.cn/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-dchai-key' }),
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('Nano_Banana_Pro_2K_0')
    expect(body.messages[0].content).toBe('夕阳美景')

    expect(result.success).toBe(true)
    expect(result.imageUrl).toBe(imageUrl)
  })

  it('returns multiple image URLs when response contains multiple images', async () => {
    const content = '![image](https://a.com/1.jpg)\n\n![image](https://a.com/2.jpg)'
    fetchMock.mockResolvedValue(makeChatResponse(content))

    const generator = new DcHaiImageGenerator('Nano_Banana_Pro_2K_0')
    const result = await generator.generate({ userId: 'user-1', prompt: 'test' })

    expect(result.success).toBe(true)
    expect(result.imageUrls).toHaveLength(2)
  })

  it('sends reference image as image_url in messages for image-to-image', async () => {
    fetchMock.mockResolvedValue(makeChatResponse('![image](https://a.com/out.jpg)'))

    const generator = new DcHaiImageGenerator('Nano_Banana_Pro_2K_1')
    await generator.generate({
      userId: 'user-1',
      prompt: '将图中人换成乔布斯',
      referenceImages: ['https://ref.com/input.jpg'],
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Array.isArray(body.messages[0].content)).toBe(true)
    expect(body.messages[0].content[0]).toEqual({ type: 'text', text: '将图中人换成乔布斯' })
    expect(body.messages[0].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'https://ref.com/input.jpg' },
    })
  })

  it('returns failure when response contains no image URLs', async () => {
    fetchMock.mockResolvedValue(makeChatResponse('sorry, cannot generate'))

    const generator = new DcHaiImageGenerator('Nano_Banana_Pro_2K_0')
    const result = await generator.generate({ userId: 'user-1', prompt: 'test' })

    expect(result.success).toBe(false)
  })

  it('retries on HTTP error and returns failure after max retries', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' })

    const generator = new DcHaiImageGenerator('Nano_Banana_Pro_2K_0')
    const result = await generator.generate({ userId: 'user-1', prompt: 'test' })

    expect(result.success).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2) // 1次 + 1次自动重试
  })
})
