import { NextRequest, NextResponse } from "next/server";

// ---- Types ----

type Slot = {
  id: string;
  label: string;
  booked: boolean;
  bookedBy: string | null;
};

type Listing = {
  id: string;
  subject: string;
  tutorName: string;
  description: string;
  hourlyRate: number;
  slots: Slot[];
  createdAt: string;
};

type CreateListingBody = {
  subject: string;
  tutorName: string;
  description: string;
  hourlyRate: number;
  slotLabels: string[];
};

type BookSlotBody = {
  listingId: string;
  slotId: string;
  studentName: string;
};

type DeleteListingBody = {
  id: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ---- In-memory fallback store (zero-config, persists for the life of the process) ----

declare global {
  // eslint-disable-next-line no-var
  var __tutoringListings: Listing[] | undefined;
}

function getMemoryStore(): Listing[] {
  if (!globalThis.__tutoringListings) {
    globalThis.__tutoringListings = [];
  }
  return globalThis.__tutoringListings;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---- Supabase REST helpers (uses fetch directly, no SDK dependency required) ----

async function supabaseRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
}

type SupabaseRow = {
  id: string;
  subject: string;
  tutor_name: string;
  description: string;
  hourly_rate: number;
  slots: Slot[];
  created_at: string;
};

function rowToListing(row: SupabaseRow): Listing {
  return {
    id: row.id,
    subject: row.subject,
    tutorName: row.tutor_name,
    description: row.description,
    hourlyRate: row.hourly_rate,
    slots: row.slots ?? [],
    createdAt: row.created_at,
  };
}

async function fetchListings(): Promise<Listing[]> {
  if (USE_SUPABASE) {
    const res = await supabaseRequest(
      "/listings?select=*&order=created_at.desc"
    );
    if (!res.ok) {
      throw new Error(`Supabase fetch failed: ${res.status}`);
    }
    const rows = (await res.json()) as SupabaseRow[];
    return rows.map(rowToListing);
  }
  return [...getMemoryStore()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

async function insertListing(body: CreateListingBody): Promise<Listing> {
  const listing: Listing = {
    id: makeId(),
    subject: body.subject.trim(),
    tutorName: body.tutorName.trim(),
    description: body.description.trim(),
    hourlyRate: body.hourlyRate,
    slots: body.slotLabels
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => ({
        id: makeId(),
        label,
        booked: false,
        bookedBy: null,
      })),
    createdAt: new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const res = await supabaseRequest("/listings", {
      method: "POST",
      body: JSON.stringify({
        id: listing.id,
        subject: listing.subject,
        tutor_name: listing.tutorName,
        description: listing.description,
        hourly_rate: listing.hourlyRate,
        slots: listing.slots,
        created_at: listing.createdAt,
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase insert failed: ${res.status}`);
    }
    const rows = (await res.json()) as SupabaseRow[];
    return rowToListing(rows[0]);
  }

  const store = getMemoryStore();
  store.push(listing);
  return listing;
}

async function bookSlot(body: BookSlotBody): Promise<Listing> {
  if (USE_SUPABASE) {
    const getRes = await supabaseRequest(
      `/listings?id=eq.${body.listingId}&select=*`
    );
    if (!getRes.ok) throw new Error("Supabase fetch failed");
    const rows = (await getRes.json()) as SupabaseRow[];
    const row = rows[0];
    if (!row) throw new Error("Listing not found");

    const slots = row.slots.map((slot) =>
      slot.id === body.slotId
        ? { ...slot, booked: true, bookedBy: body.studentName }
        : slot
    );

    const patchRes = await supabaseRequest(
      `/listings?id=eq.${body.listingId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ slots }),
      }
    );
    if (!patchRes.ok) throw new Error("Supabase update failed");
    const updatedRows = (await patchRes.json()) as SupabaseRow[];
    return rowToListing(updatedRows[0]);
  }

  const store = getMemoryStore();
  const listing = store.find((item) => item.id === body.listingId);
  if (!listing) throw new Error("Listing not found");

  listing.slots = listing.slots.map((slot) =>
    slot.id === body.slotId
      ? { ...slot, booked: true, bookedBy: body.studentName }
      : slot
  );
  return listing;
}

async function deleteListing(id: string): Promise<void> {
  if (USE_SUPABASE) {
    const res = await supabaseRequest(`/listings?id=eq.${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Supabase delete failed");
    return;
  }
  const store = getMemoryStore();
  const idx = store.findIndex((item) => item.id === id);
  if (idx !== -1) store.splice(idx, 1);
}

// ---- Route handlers ----

export async function GET() {
  try {
    const listings = await fetchListings();
    return NextResponse.json({ listings });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load listings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CreateListingBody>;

    if (
      !body.subject ||
      !body.tutorName ||
      !body.description ||
      typeof body.hourlyRate !== "number" ||
      Number.isNaN(body.hourlyRate) ||
      !Array.isArray(body.slotLabels) ||
      body.slotLabels.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing or invalid listing fields." },
        { status: 400 }
      );
    }

    const listing = await insertListing({
      subject: body.subject,
      tutorName: body.tutorName,
      description: body.description,
      hourlyRate: body.hourlyRate,
      slotLabels: body.slotLabels,
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create listing." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<BookSlotBody>;

    if (!body.listingId || !body.slotId || !body.studentName) {
      return NextResponse.json(
        { error: "Missing booking fields." },
        { status: 400 }
      );
    }

    const listing = await bookSlot({
      listingId: body.listingId,
      slotId: body.slotId,
      studentName: body.studentName,
    });

    return NextResponse.json({ listing });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to book slot." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DeleteListingBody>;

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing listing id." },
        { status: 400 }
      );
    }

    await deleteListing(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete listing." },
      { status: 500 }
    );
  }
}
