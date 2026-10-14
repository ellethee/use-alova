# Security policy

## Supported versions

Only the latest minor release of `@ilpachi/use-alova` receives security fixes.

| Version | Supported |
| --- | --- |
| Latest minor (currently 2.1.x) | Yes |
| Anything older (including 1.x) | No: please upgrade |

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately by email to
[ilpachi@ilpachi.it](mailto:ilpachi@ilpachi.it) and include:

- the affected version;
- a description of the problem and its impact;
- steps or a minimal example to reproduce it.

## Response times

This is a best-effort project: we aim to acknowledge a report within 5 business days. Once the issue is confirmed, a
fix and a new release follow as soon as practicable. Please allow reasonable time for a fix before disclosing the problem
publicly.

## Scope notes

- The `Authorization` token is sent to requests built from a relative url (they target the configured `baseURL`, even when it is cross-origin: the `baseURL` is trusted) and, for absolute urls, only to same-origin requests or to the origins you list in `authOrigins`.
- The CSRF token (`csrfHandler` from `@ilpachi/use-alova/csrf`) is sent only to same-origin requests, never cross-origin.
- Notification text is always inserted as text, never as HTML.
