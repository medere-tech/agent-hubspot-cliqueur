/**
 * Test the full sync pipeline: HubSpot top clickers → click themes → Supabase upsert.
 * Processes only the first 5 contacts to verify the flow without hitting rate limits.
 *
 * Usage: npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/test-sync.ts
 */

import { syncAllTopClickers } from '@/lib/sync'

async function main() {
  console.log('='.repeat(60))
  console.log('TEST SYNC — 5 premiers contacts')
  console.log('='.repeat(60))

  const result = await syncAllTopClickers(
    (msg) => console.log(msg),
    5
  )

  console.log('='.repeat(60))
  console.log('RÉSUMÉ FINAL')
  console.log(`  Synced   : ${result.synced}`)
  console.log(`  Errors   : ${result.errors}`)
  console.log(`  Duration : ${(result.duration / 1000).toFixed(1)}s`)
  console.log('='.repeat(60))
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
