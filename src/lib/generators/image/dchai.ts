/**
 * DcHai 图像生成器
 *
 * 通过 chat completions 接口生成图像，响应内容为 Markdown 格式的图片链接。
 * 支持文生图和图生图，自动重试由 BaseImageGenerator 处理（最多 2 次）。
 *
 * API 端点：https://sg2.dchai.cn/v1/chat/completions
 */

import { BaseImageGenerator, type GenerateResult, type ImageGenerateParams } from '../base'
import { getProviderConfig } from '@/lib/api-config'

const DCHAI_DEFAULT_BASE_URL = 'https://sg2.dchai.cn/v1'

/**
 * 从 Markdown 内容中提取图片 URL
 * 匹配格式：![任意文字](https://...)
 */
function parseImageUrlsFromMarkdown(content: string): string[] {
  const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g
  const urls: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    // 还原 Unicode 转义（如 \u0026 → &）
    urls.push(match[1].replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ))
  }
  return urls
}

export class DcHaiImageGenerator extends BaseImageGenerator {
  private readonly modelId: string
  private readonly providerId: string

  constructor(modelId: string, providerId = 'dchai') {
    super()
    this.modelId = modelId
    this.providerId = providerId
  }

  protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
    const { userId, prompt, referenceImages = [] } = params

    const config = await getProviderConfig(userId, this.providerId)
    const baseUrl = (config.baseUrl || DCHAI_DEFAULT_BASE_URL).replace(/\/+$/, '')

    // 构建消息内容：图生图时附带参考图
    type MessageContent =
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
        >

    let content: MessageContent
    if (referenceImages.length > 0) {
      content = [
        { type: 'text', text: prompt },
        ...referenceImages.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ]
    } else {
      content = prompt
    }

    const requestBody = {
      model: this.modelId,
      messages: [{ role: 'user', content }],
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DCHAI_IMAGE_FAILED(${response.status}): ${errorText}`)
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: { content?: string }
      }>
    }

    const messageContent = data.choices?.[0]?.message?.content
    if (!messageContent) {
      throw new Error('DCHAI_IMAGE_EMPTY_RESPONSE: no content returned')
    }

    const imageUrls = parseImageUrlsFromMarkdown(messageContent)
    if (imageUrls.length === 0) {
      throw new Error('DCHAI_IMAGE_NO_URLS: no image URLs found in response')
    }

    return {
      success: true,
      imageUrl: imageUrls[0],
      ...(imageUrls.length > 1 ? { imageUrls } : {}),
    }
  }
}
