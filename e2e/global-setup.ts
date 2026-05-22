import fs from 'fs'
import path from 'path'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

const githubRunId = process.env.GITHUB_RUN_ID ?? undefined
const testRunId = githubRunId ? `gh-${githubRunId}` : undefined

const entries: { name: string; value: string }[] = [
  { name: 'traffic_type', value: 'e2e' },
  { name: 'rm-landing-seen', value: '1' },
  { name: 'rm-install-dismissed', value: '1' },
  ...(githubRunId ? [{ name: 'github_run_id', value: githubRunId }] : []),
  ...(testRunId ? [{ name: 'test_run_id', value: testRunId }] : []),
]

const storageState = {
  cookies: [],
  origins: [
    {
      origin: BASE_URL,
      localStorage: entries,
    },
  ],
}

export default async function globalSetup() {
  const outPath = path.resolve('playwright-e2e-state.json')
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
}
