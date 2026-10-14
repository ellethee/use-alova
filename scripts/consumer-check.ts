// Compile-time check of the PUBLISHED declarations (run by `pnpm build` through tsconfig.dist.json, which maps
// the package subpaths to `dist/*.d.ts`). The entry points ship self-contained declarations, so this verifies that
// types coming from one subpath are accepted by the others (e.g. `csrfHandler()` in `beforeRequestHandlers`).
import {
  createUseAlova,
  defaultErrorHandlers,
  STOP_PROCESSOR,
  ResponseError,
} from '@ilpachi/use-alova'
import type {
  OverlayOptions,
  UseAlovaBeforeRequest,
  UseAlovaOptions,
  UseAlovaResponseProcessor,
} from '@ilpachi/use-alova'
import { toastMessage, boxMessage, createToastMessage } from '@ilpachi/use-alova/notify'
import { domOverlay } from '@ilpachi/use-alova/overlay'
import { blobHandler, domHandler, fileSuccessHandlers, withFiles } from '@ilpachi/use-alova/files'
import type { BlobResponse } from '@ilpachi/use-alova/files'
import { csrfHandler } from '@ilpachi/use-alova/csrf'

const overlay: OverlayOptions = domOverlay({ mode: 'auto', delay: 100 })
const options: UseAlovaOptions = {
  baseURL: '/api',
  token: () => 'x',
  errorMessageFunction: toastMessage,
  overlay,
  beforeRequestHandlers: [csrfHandler({ cookieName: 'c' }), STOP_PROCESSOR],
  successHandlers: fileSuccessHandlers,
  unwrapEnvelope: true,
  errorHandlers: [
    {
      '401': async ({ retry, retried }) => (retried ? undefined : [await retry(), STOP_PROCESSOR]),
    },
    ...defaultErrorHandlers,
  ],
}
const api = withFiles(createUseAlova(options)({ url: '/files' }))
const saved: Promise<BlobResponse | null> = api.$download('/report', { fileName: 'report.pdf' })
const others: UseAlovaOptions[] = [
  { errorMessageFunction: boxMessage },
  { errorMessageFunction: createToastMessage({ timer: 0 }) },
]
const nothing: ResponseError | undefined = undefined

// STOP_PROCESSOR is a `unique symbol` shared by all the entry points: the values returned by the handlers of
// `/files` are assignable to the type of the core, and any other symbol is not.
const stop: typeof STOP_PROCESSOR = STOP_PROCESSOR
async function stopFromFiles(): Promise<typeof STOP_PROCESSOR | undefined> {
  const blob = await blobHandler({} as Parameters<typeof blobHandler>[0])
  const dom = await domHandler({} as Parameters<typeof domHandler>[0])
  return blob?.[1] ?? dom?.[1]
}
// Handlers of the subpaths are accepted where the core expects them, and the core types where the subpaths do.
const entry: UseAlovaBeforeRequest = csrfHandler()
const processors: readonly UseAlovaResponseProcessor[] = [
  blobHandler,
  domHandler,
  ...fileSuccessHandlers,
]
const coreReturn: Parameters<typeof withFiles>[0] = createUseAlova({})()
// @ts-expect-error a symbol that is not STOP_PROCESSOR is not a `typeof STOP_PROCESSOR`
const anySymbol: typeof STOP_PROCESSOR = Symbol('other')
// @ts-expect-error nor is it accepted as a beforeRequestHandlers entry
const badOptions: UseAlovaOptions = { beforeRequestHandlers: [Symbol('other')] }
// @ts-expect-error nor as a pipeline entry
const badSet: UseAlovaOptions = { errorHandlers: [Symbol('other')] }

export {
  saved,
  others,
  nothing,
  stop,
  stopFromFiles,
  entry,
  processors,
  coreReturn,
  anySymbol,
  badOptions,
  badSet,
}
