// Reads the receipt-check link (/?verifyReceipt=<no>&gcc=<gcc>&amt=<amount>) from the URL.
export function receiptCheckParams() {
  try {
    const q = new URLSearchParams(window.location.search)
    const receipt = q.get('verifyReceipt')
    return receipt ? { receipt, gcc: q.get('gcc') || '', amt: q.get('amt') || '' } : null
  } catch { return null }
}
