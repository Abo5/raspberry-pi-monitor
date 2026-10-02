// An iPhone set to Arabic (or Persian) types Arabic-Indic digits — "١٩٢٫١٦٨…" —
// on the number and URL keyboards. Hosts, IPs and ports must be plain ASCII, or
// the connection silently fails ("couldn't reach the Pi"). Convert as the user
// types, so what they see is exactly what we connect to.

const ARABIC_INDIC = 0x0660; // ٠..٩
const PERSIAN = 0x06f0; // ۰..۹

export function latinDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - PERSIAN))
    .replace(/٫/g, '.') // Arabic decimal separator ٫
    .replace(/[٬،]/g, ','); // Arabic thousands separator ٬ and comma ،
}
