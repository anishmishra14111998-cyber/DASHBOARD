// Guest-management team — edit this list to add/remove people.
// Shown in the "Contacted By" dropdown on the Checkouts tab.
export const GUEST_MGMT_STAFF = [
  "Ricky",
  "Maichel",
  "Maria",
  "Teresa",
  "Gustavo",
] as const;

export type StaffName = typeof GUEST_MGMT_STAFF[number];
