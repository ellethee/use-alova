import type { UseAlovaOptions } from './types'

/** Default parameters of `useAlova(params)`: no extra url. */
export const defaultParams: { url?: string } = {
  url: undefined,
}

/** Default values of the options that have one (everything else is off or empty by default). */
export const defaultOptions: UseAlovaOptions = {
  debug: false,
  autoError: true,
  unwrapEnvelope: false,
  envelopeErrors: 'data',
  authType: 'Bearer',
}
