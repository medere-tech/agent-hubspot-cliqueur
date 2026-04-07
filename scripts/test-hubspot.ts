import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const token = process.env.HUBSPOT_ACCESS_TOKEN
if (!token) {
  console.error('HUBSPOT_ACCESS_TOKEN manquant')
  process.exit(1)
}

async function main() {
  const url = 'https://api.hubapi.com/marketing/v3/campaigns?limit=100&properties=hs_name,hs_startdate,hs_enddate'
  console.log('URL :', url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })

  console.log('Status :', res.status)
  const data = await res.json() as { total?: number; results: Array<{ id: string; properties: { hs_name?: string }; updatedAt: string }> }

  console.log('Total :', data.total ?? data.results.length)
  console.log('\nCampagnes :')
  for (const c of data.results) {
    console.log(`  [${c.updatedAt.slice(0, 10)}] ${c.properties.hs_name ?? '(sans nom)'}`)
  }
}

main()
