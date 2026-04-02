/**
 * MiniMax TTS（文本转语音）API 封装
 *
 * 使用 T2A v2 接口：POST https://api.minimaxi.com/v1/t2a_v2
 * 响应中 data.audio 为十六进制编码的音频数据
 */

const MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1'

interface MinimaxTTSParams {
  text: string
  voiceId: string
  modelId: string
  speed?: number
}

interface MinimaxTTSResult {
  success: boolean
  audioData?: Buffer
  audioDuration?: number
  error?: string
}

function estimateMp3DurationMs(buffer: Buffer): number {
  // 按 128kbps 估算时长（MiniMax 默认码率）
  const bitrate = 128000
  return Math.round((buffer.length * 8 * 1000) / bitrate)
}

export async function synthesizeWithMinimaxTTS(
  params: MinimaxTTSParams,
  apiKey: string,
): Promise<MinimaxTTSResult> {
  const { text, voiceId, modelId, speed = 1.0 } = params

  const requestBody = {
    model: modelId,
    text,
    voice_setting: {
      voice_id: voiceId,
      speed,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      format: 'mp3',
      audio_sample_rate: 32000,
      bitrate: 128000,
    },
  }

  let response: Response
  try {
    response = await fetch(`${MINIMAX_BASE_URL}/t2a_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    return {
      success: false,
      error: `MINIMAX_TTS_NETWORK_ERROR: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      error: `MINIMAX_TTS_FAILED(${response.status}): ${errorText}`,
    }
  }

  const data = await response.json() as {
    data?: { audio?: string }
    base_resp?: { status_code?: number; status_msg?: string }
  }

  if (data.base_resp?.status_code !== 0) {
    return {
      success: false,
      error: `MINIMAX_TTS_API_ERROR: ${data.base_resp?.status_msg ?? 'unknown error'}`,
    }
  }

  const hexAudio = data.data?.audio
  if (!hexAudio) {
    return {
      success: false,
      error: 'MINIMAX_TTS_NO_AUDIO: response contains no audio data',
    }
  }

  const audioData = Buffer.from(hexAudio, 'hex')
  const audioDuration = estimateMp3DurationMs(audioData)

  return {
    success: true,
    audioData,
    audioDuration,
  }
}
