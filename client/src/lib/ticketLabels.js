// Mirrors CASE_TYPE_MAP in server/src/routes/tickets.js — keep in sync.
export const CASE_TYPE_LABELS = {
  1: 'Billing',
  2: 'Claims',
  3: 'Policy Change',
  4: 'General',
};

// Stock Dataverse incident Status Reason (statuscode) option set. If this
// environment's solution customizes it, update to match the real values.
export const STATUS_LABELS = {
  1: 'In Progress',
  2: 'On Hold',
  3: 'Waiting for Details',
  4: 'Researching',
  5: 'Problem Solved',
  6: 'Cancelled',
  1000: 'Information Provided',
  2000: 'Merged',
};

export function caseTypeLabel(code) {
  return CASE_TYPE_LABELS[code] ?? code;
}

export function statusLabel(code) {
  return STATUS_LABELS[code] ?? code;
}

// Maps statuscode to a .status-pill modifier class so ticket lists read
// at a glance: resolved reads green, cancelled reads red, everything
// still-open (in progress/on hold/etc.) stays the neutral default.
export function statusPillClass(code) {
  if (code === 5) return 'ok';
  if (code === 6) return 'danger';
  return '';
}

export function isOpenStatus(code) {
  return code !== 5 && code !== 6 && code !== 2000;
}
