/// <reference types="vite/client" />
/// <reference types="vite-plugin-electron/electron-env" />

import type { TvFacilApi } from '../electron/preload'

declare global {
  interface Window {
    tvfacil?: TvFacilApi
  }
}

export {}
