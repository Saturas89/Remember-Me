import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://storyhold.app'

const githubRunId    = process.env.GITHUB_RUN_ID    ?? undefined
const testRunId      = githubRunId ? `gh-${githubRunId}` : undefined
const browserProfile = process.env.BROWSER_PROFILE  ?? undefined
const deviceProfile  = process.env.DEVICE_PROFILE   ?? undefined

const entries: { name: string; value: string }[] = [
  { name: 'traffic_type', value: 'e2e' },
  ...(githubRunId    ? [{ name: 'github_run_id',   value: githubRunId    }] : []),
  ...(testRunId      ? [{ name: 'test_run_id',     value: testRunId      }] : []),
  ...(browserProfile ? [{ name: 'browser_profile', value: browserProfile }] : []),
  ...(deviceProfile  ? [{ name: 'device_profile',  value: deviceProfile  }] : []),
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
  const outPath = path.resolve('playwright-production-state.json')
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
}
