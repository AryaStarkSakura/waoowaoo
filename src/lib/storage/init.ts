import { ensureStorageReady } from '@/lib/storage/bootstrap'
import { requireEnv } from '@/lib/storage/utils'

async function main() {
  const result = await ensureStorageReady()

  if (result === 'skipped') {
    return
  }

  const bucket = requireEnv('MINIO_BUCKET')
  if (result === 'created') {
    console.log(`[storage:init] created MinIO bucket "${bucket}"`)
    return
  }

  console.log(`[storage:init] verified MinIO bucket "${bucket}"`)
}

void main().catch((error: unknown) => {
  console.error('[storage:init] failed to prepare storage')
  console.error(error)
  process.exit(1)
})
