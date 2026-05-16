export type Channel = "guesty-direct" | "booking" | "airbnb" | "vrbo" | "other";

export interface Reservation {
  id: string;
  confirmationCode: string;
  channel: Channel;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;

  // Money breakdown (per Guesty money object, GAAP-style fields)
  netAccommodation: number;   // money.fareAccommodationAdjusted
  cleaningFare: number;       // money.fareCleaning (or adjusted)
  otherFees: number;          // residual: totalPrice - accom - cleaning - taxes
  taxes: number;              // money.totalTaxes
  grossRevenue: number;       // accom + cleaning + other + taxes (≈ totalPrice)
  channelCommission: number;  // money.hostServiceFee (channel commission)
  netPayout: number;          // money.netIncome / hostPayout
  currency: string;

  status: "confirmed" | "cancelled" | "pending";
  createdAt?: string;   // ISO — when the reservation was booked (from Guesty createdAt)

  // Payment status + cleared payment transactions surfaced from Guesty.
  // Used to derive a "cash received" basis (when money actually hits the
  // account) independent of when the booking was made or the stay happens.
  paymentStatus?: string;        // "paid" | "partially_paid" | "unpaid" | ...
  balanceDue?: number;
  payments?: ReservationPayment[];
}

export interface ReservationPayment {
  amount: number;                // positive for incoming, negative for refunds
  status: string;                // "succeeded" / "captured" / "pending" / ...
  paidAt: string;                // YYYY-MM-DD — first non-empty of paidAt/capturedAt/createdAt
  method?: string;               // e.g. "credit_card", "channel-payout"
}

export interface Property {
  id: string;
  name: string;
  city: string;
  bedrooms: number;
  nightlyBase: number;
}

export interface SourceStatus {
  connected: boolean;
  mode: "live" | "mock";
  message: string;
}

export interface MetricsResponse {
  generatedAt: string;
  sources: { guesty: SourceStatus };
  properties: Property[];
  reservations: Reservation[];
}
