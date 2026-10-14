/**
 * Appends one value to a `FormData`/`URLSearchParams`-like target.
 * `null`/`undefined` are skipped, arrays append each item, plain objects are JSON-stringified,
 * `Blob`s are appended as they are (only for `FormData`), everything else is stringified.
 *
 * @param target - Object exposing `append(key, value)`.
 * @param key - Field name.
 * @param value - Field value.
 * @param allowBlob - Whether `Blob` values are kept as they are.
 */
function appendValue(
  target: { append(key: string, value: any): void },
  key: string,
  value: unknown,
  allowBlob: boolean
): void {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach(item => appendValue(target, key, item, allowBlob))
    return
  }
  if (allowBlob && typeof Blob !== 'undefined' && value instanceof Blob) {
    target.append(key, value)
    return
  }
  if (value instanceof Date) {
    target.append(key, value.toISOString())
    return
  }
  if (typeof value === 'object') {
    target.append(key, JSON.stringify(value))
    return
  }
  target.append(key, String(value))
}

/**
 * Builds a `URLSearchParams` from a plain object, skipping `null`/`undefined` values,
 * appending each item of arrays and JSON-stringifying plain objects.
 *
 * @param data - Source object.
 * @returns The populated `URLSearchParams`.
 */
export function toUrlSearchParams(
  data: Record<string, unknown> | null | undefined
): URLSearchParams {
  const params = new URLSearchParams()
  Object.entries(data ?? {}).forEach(([key, value]) => appendValue(params, key, value, false))
  return params
}

/**
 * Converts a `FormData` (string entries only) into a `URLSearchParams`, keeping repeated keys.
 *
 * @param formData - Source `FormData`.
 * @returns The populated `URLSearchParams`.
 * @throws TypeError if any entry is a `File`/`Blob` (an urlencoded body cannot carry files: use `$upload`).
 */
export function formDataToUrlSearchParams(formData: FormData): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') throw new TypeError('$form cannot send files, use $upload')
    params.append(key, value)
  }
  return params
}

/**
 * Builds a `FormData` with the given files and extra fields (same value rules as {@link toUrlSearchParams},
 * but `Blob` values are kept as they are).
 *
 * @param files - A file/blob or an array of them. A `Blob` without a `name` is sent with the file name `'blob'`.
 * @param data - Extra fields.
 * @param fieldName - Field name for the files (default `'file'` for one file, `'files'` for many).
 * @returns The populated `FormData`.
 */
export function toFormData(
  files: File | Blob | Array<File | Blob>,
  data: Record<string, unknown> | null | undefined,
  fieldName?: string
): FormData {
  const formData = new FormData()
  const fileArray = Array.isArray(files) ? files : [files]
  const name = fieldName ?? (fileArray.length > 1 ? 'files' : 'file')
  fileArray.forEach(file => formData.append(name, file, (file as File).name ?? 'blob'))
  Object.entries(data ?? {}).forEach(([key, value]) => appendValue(formData, key, value, true))
  return formData
}
