export type Channel = "guesty-direct" | "booking" | "airbnb" | "other";

export interface Reservation {
  id: string;
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
