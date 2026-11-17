/** Read legacy wire names during an in-place Umami to Formami upgrade.
 * The new name wins when both are present. Authentication remains unchanged.
 */
export function getCompatibleHeader(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.replace(/^x-formami-/, 'x-umami-'));
}
