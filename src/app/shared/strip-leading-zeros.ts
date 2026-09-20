/** A number field showing "0" would turn a typed "11000" into "011000" — the browser keeps the
 *  leading zero. This drops leading zeros as the user types ("011000" → "11000", "007" → "7") while
 *  leaving "0" and decimals like "0.5" alone. It runs in the capture phase, before Angular's own
 *  input listener, so bound models only ever see the cleaned value. Applies to every number field. */
export function stripLeadingZerosFromNumberInputs(): void {
  document.addEventListener(
    'input',
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement) || el.type !== 'number') return;
      const cleaned = el.value.replace(/^(-?)0+(?=\d)/, '$1');
      if (cleaned !== el.value) el.value = cleaned;
    },
    true,
  );
}
