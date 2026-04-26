import type { Channel, Property, Reservation } from "./types";

export const properties: Property[] = [
  { id: "p-001", name: "Sunset Loft",      city: "Lisbon",    bedrooms: 1, nightlyBase: 145 },
  { id: "p-002", name: "Harbor View 2BR",  city: "Lisbon",    bedrooms: 2, nightlyBase: 220 },
  { id: "p-003", name: "Old Town Studio",  city: "Porto",     bedrooms: 0, nightlyBase: 95  },
  { id: "p-004", name: "Garden House",     city: "Barcelona", bedrooms: 3, nightlyBase: 310 },
  { id: "p-005", name: "Beachside Casita", city: "Valencia",  bedrooms: 2, nightlyBase: 185 },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function generateReservations(channel: Channel, seed: number, count: number): Reservation[] {
  const rand = rng(seed);
  const today = new Date();
  const start = addDays(today, -180);
  const out: Reservation[] = [];

  for (let i = 0; i < count; i++) {
    const prop = properties[Math.floor(rand() * properties.length)];
    const offset = Math.floor(rand() * 200);
    const checkIn = addDays(start, offset);
    const nights = 1 + Math.floor(rand() * 7);
    const checkOut = addDays(checkIn, nights);
    const seasonal = 1 + 0.25 * Math.sin((checkIn.getMonth() / 12) * Math.PI * 2);
    const netAccommodation = Math.round(prop.nightlyBase * nights * seasonal * (0.85 + rand() * 0.4));
    const cleaningFare = 35 + Math.floor(rand() * 40);
    const otherFees = Math.round(rand() * 25);
    const taxes = Math.round(netAccommodation * 0.07);
    const grossRevenue = netAccommodation + cleaningFare + otherFees + taxes;
    const commissionRate =
      channel === "booking" ? 0.15 :
      channel === "airbnb"  ? 0.14 :
      channel === "guesty-direct" ? 0.03 : 0.05;
    const channelCommission = Math.round(netAccommodation * commissionRate);

    out.push({
      id: `${channel}-${seed}-${i}`,
      channel,
      propertyId: prop.id,
      propertyName: prop.name,
      checkIn: isoDate(checkIn),
      checkOut: isoDate(checkOut),
      nights,
      guests: 1 + Math.floor(rand() * 4),
      netAccommodation,
      cleaningFare,
      otherFees,
      taxes,
      grossRevenue,
      channelCommission,
      netPayout: grossRevenue - channelCommission - taxes,
      currency: "USD",
      status: rand() > 0.05 ? "confirmed" : "cancelled",
    });
  }
  return out;
}
