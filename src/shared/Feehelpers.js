// shared/feeHelpers.js

import { fmt as _fmt } from '../feeEngine'

export const fmt    = n => _fmt(n).replace('₹', '')
export const fmtNum = fmt

export {
  fmtMoney,
  fmtDate,
  fmtMonth,
  today,
  gccStr,
  rcptNo,

  INSTITUTE,
  CURRENT_YEAR,
  INVOICE_STATUS,
  PAYMENT_METHODS,
  PAY_MODES,
  MONTHS_LIST,

  FLAT_RATES   as FLAT_FEE_RATES,
  COURSE_RATES as COURSE_FEES,

  getFlatFeeAmt,
  getFlatFees,
  getCourseFeeAmt,

  sourceRef,
  recordPayment,
  printReceipt,
  buildReceiptHTML,

  getStudentFeeSummary,
  upsertAccount,
  checkCourseFeeExists,
  checkFlatFeeExists,
  promoteToStudent,
} from '../feeEngine'