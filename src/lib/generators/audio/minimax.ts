/**
 * MiniMax 语音生成器
 *
 * 支持模型：speech-01-turbo, speech-01-hd, speech-02-hd, speech-02-turbo
 */

import { BaseAudioGenerator, type AudioGenerateParams, type GenerateResult } from '../base'
import { getProviderConfig } from '@/lib/api-config'
import { synthesizeWithMinimaxTTS } from '@/lib/providers/minimax/tts'

export class MinimaxTTSGenerator extends BaseAudioGenerator {
  protected async doGenerate(params: AudioGenerateParams): Promise<GenerateResult> {
    const { userId, text, voice = 'male-qn-qingse', rate = 1.0, options = {} } = params
    const modelId = (options.modelId as string | undefined) || 'speech-01-turbo'

    const { apiKey } = await getProviderConfig(userId, 'minimax')

    const result = await synthesizeWithMinimaxTTS(
      { text, voiceId: voice, modelId, speed: rate },
      apiKey,
    )

    if (!result.success || !result.audioData) {
      throw new Error(result.error || 'MINIMAX_TTS_FAILED')
    }

    // 将 Buffer 转为 base64 data URL 返回
    const base64 = result.audioData.toString('base64')
    return {
      success: true,
      audioUrl: `data:audio/mp3;base64,${base64}`,
    }
  }
}
