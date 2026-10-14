# Migration from 1.x

2.0 splits the package: a small core without UI, plus opt-in subpaths. Request/response behavior and
security rules are unchanged. The complete old -> new table is in the repository `README.md`
(section "Migration from 1.x"); the essentials:

| 1.x | 2.x |
| --- | --- |
| `errorMessageFunction: 'toast'` | `errorMessageFunction: toastMessage` from `/notify` (default: nothing shown) |
| `spinner`, `showOverlay: Component` | `overlay: domOverlay(...)` from `/overlay`; `showOverlay` is a boolean |
| `store` + `storeKey` | `token: () => store.token` |
| built-in CSRF | `beforeRequestHandlers: [csrfHandler()]` from `/csrf` |
| `$download`, `$form`, `$upload` on `useAlova()` | `withFiles(useAlova())` from `/files` |
| default `successHandlers` = blob, DOM, JSON | `successHandlers: fileSuccessHandlers` to keep it |
| `useRequest` and other hooks from `useAlova()` | import from `alova/client` |
