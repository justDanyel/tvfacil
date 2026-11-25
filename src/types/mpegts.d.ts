declare module 'mpegts.js' {
  export interface Player {
    attachMediaElement(mediaElement: HTMLMediaElement): void
    detachMediaElement(): void
    load(): void
    unload(): void
    play(): Promise<void> | void
    pause(): void
    destroy(): void
    on(event: string, listener: (...args: unknown[]) => void): void
    off(event: string, listener: (...args: unknown[]) => void): void
  }

  export interface FeatureList {
    mseLivePlayback: boolean
  }

  interface MpegtsStatic {
    createPlayer(
      mediaDataSource: {
        type: string
        isLive?: boolean
        url: string
        cors?: boolean
        withCredentials?: boolean
      },
      config?: Record<string, unknown>,
    ): Player
    getFeatureList(): FeatureList
    isSupported(): boolean
    Events: { ERROR: string; LOADING_COMPLETE: string; MEDIA_INFO: string }
  }

  const mpegts: MpegtsStatic
  export default mpegts
}
