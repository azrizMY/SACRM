/** Type shim for the `qrcode` package's pure-JS algorithmic core, imported by qr-code.ts via a
 *  deep path — see that file for why the package root can't be imported in a browser bundle. */
declare module 'qrcode/lib/core/qrcode.js' {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' },
  ): {
    modules: {
      size: number;
      get(row: number, col: number): number;
    };
  };
}
