import type { AppState, SyncProviderType } from '../types'

export type { SyncProviderType }

export interface PullResult {
  merged: AppState
  downloadedMediaIds: string[]
}

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: 'auth' | 'network' | 'quota' | 'decrypt' | 'unknown',
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

export interface MediaStoreAccessor {
  getImageBlob(id: string): Promise<Blob | null>
  getAudioBlob(id: string): Promise<Blob | null>
  getVideoBlob(id: string): Promise<Blob | null>
  putImage(id: string, blob: Blob): Promise<void>
  putAudio(id: string, blob: Blob): Promise<void>
  putVideo(id: string, blob: Blob): Promise<void>
  listLocalMediaIds(): Promise<{
    images: string[]
    audio: string[]
    videos: string[]
  }>
}

export interface SyncProvider {
  readonly type: SyncProviderType

  isAuthenticated(): boolean
  signIn(): Promise<void>
  signOut(): Promise<void>
  push(state: AppState, media: MediaStoreAccessor): Promise<void>
  pull(localState: AppState, media: MediaStoreAccessor): Promise<PullResult | null>
  deactivate(deleteRemote: boolean): Promise<void>
  // Returns true if a pending OAuth redirect was successfully consumed and a
  // fresh token is now persisted. Providers without a redirect flow (popup,
  // password) return false.
  resumeFromOAuth?(): Promise<boolean>
}
