#!/usr/bin/env node
// Deletes orphaned anonymous Supabase users created by e2e test runs.
//
// Test users are identified by raw_user_meta_data.traffic_type = 'e2e', set
// in ensureAnonymousSession() when localStorage.traffic_type is 'e2e'
// (injected by spawnRealDevice in e2e/nightly/helpers.ts).
//
// Only users older than MAX_AGE_DAYS are deleted so in-flight test runs are
// never affected.
//
// Called by the cleanup-e2e-users job in nightly-production.yml.
//
// Required env vars:
//   SUPABASE_URL              – production Supabase API URL
//   SUPABASE_SERVICE_ROLE_KEY – service-role JWT (bypasses RLS)
//
// Optional:
//   E2E_CLEANUP_MAX_AGE_DAYS  – default 7

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_AGE_DAYS = Number(process.env.E2E_CLEANUP_MAX_AGE_DAYS ?? '7')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.warn('cleanup-e2e-users: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set – skipping')
  process.exit(0)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
console.log(`Deleting e2e users created before ${cutoff} (> ${MAX_AGE_DAYS} days old)`)

// Collect all e2e-tagged users via paginated admin API
let page = 1
const perPage = 1000
/** @type {import('@supabase/supabase-js').User[]} */
const toDelete = []

while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
  if (error) {
    console.error('Failed to list users:', error.message)
    process.exit(1)
  }

  for (const user of data.users) {
    if (user.user_metadata?.traffic_type === 'e2e' && user.created_at < cutoff) {
      toDelete.push(user)
    }
  }

  if (data.nextPage === null || data.users.length < perPage) break
  page = data.nextPage
}

console.log(`Found ${toDelete.length} orphaned e2e user(s) to delete`)

let deleted = 0
let failed = 0
for (const user of toDelete) {
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.warn(`  FAIL ${user.id} (created ${user.created_at}): ${error.message}`)
    failed++
  } else {
    deleted++
  }
}

console.log(`Done: deleted ${deleted}${failed ? `, ${failed} failed` : ''}`)
if (failed > 0) process.exit(1)
