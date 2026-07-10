"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

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

type FormState = {
  subject: string;
  tutorName: string;
  hourlyRate: string;
  description: string;
  slotLabels: string;
};

const initialForm: FormState = {
  subject: "",
  tutorName: "",
  hourlyRate: "",
  description: "",
  slotLabels: "",
};

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition duration-150 focus:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function Home() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeSlotKey, setActiveSlotKey] = useState<string | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoadingKey, setBookingLoadingKey] = useState<string | null>(
    null
  );

  const loadListings = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { listings: Listing[] };
      setListings(data.listings);
    } catch {
      setLoadError(
        "Couldn't load listings. Check your connection and try again."
      );
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const trimmedSubject = form.subject.trim();
    const trimmedTutor = form.tutorName.trim();
    const trimmedDescription = form.description.trim();
    const rate = Number(form.hourlyRate);
    const slotLabels = form.slotLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!trimmedSubject || !trimmedTutor || !trimmedDescription) {
      setFormError("Fill in the subject, your name, and a short description.");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setFormError("Enter a valid hourly rate.");
      return;
    }
    if (slotLabels.length === 0) {
      setFormError("Add at least one available time, separated by commas.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: trimmedSubject,
          tutorName: trimmedTutor,
          description: trimmedDescription,
          hourlyRate: rate,
          slotLabels,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { listing: Listing };
      setListings((prev) => [data.listing, ...(prev ?? [])]);
      setForm(initialForm);
    } catch {
      setFormError("Couldn't post your listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Request failed");
      setListings((prev) => (prev ?? []).filter((item) => item.id !== id));
    } catch {
      setLoadError("Couldn't remove that listing. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBook(listingId: string, slotId: string) {
    const key = `${listingId}:${slotId}`;
    if (!bookingName.trim()) {
      setBookingError("Enter your name to reserve this slot.");
      return;
    }
    setBookingError(null);
    setBookingLoadingKey(key);
    try {
      const res = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          slotId,
          studentName: bookingName.trim(),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = (await res.json()) as { listing: Listing };
      setListings((prev) =>
        (prev ?? []).map((item) =>
          item.id === listingId ? data.listing : item
        )
      );
      setActiveSlotKey(null);
      setBookingName("");
    } catch {
      setBookingError("Couldn't book that slot. Try again.");
    } finally {
      setBookingLoadingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <header className="mb-12 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Campus Tutors
          </h1>
          <p className="mt-3 text-lg leading-8 text-zinc-600">
            Post a session, browse peer tutors, and lock in a time — no
            back-and-forth emails required.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
          {/* Form column */}
          <section className="h-fit rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-8">
            <h2 className="text-base font-semibold text-zinc-900">
              Offer to tutor
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              Fill this out once — students will book directly from your
              listing.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Subject or course" htmlFor="subject">
                <input
                  id="subject"
                  type="text"
                  placeholder="Organic Chemistry II"
                  value={form.subject}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Your name" htmlFor="tutorName">
                <input
                  id="tutorName"
                  type="text"
                  placeholder="Priya Shah"
                  value={form.tutorName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tutorName: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Hourly rate (USD)" htmlFor="hourlyRate">
                <input
                  id="hourlyRate"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="25"
                  value={form.hourlyRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="What you help with" htmlFor="description">
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Problem sets, exam prep, and lab reports."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <Field
                label="Available times"
                htmlFor="slotLabels"
                hint="Separate with commas, e.g. Mon 4pm, Wed 5pm"
              >
                <input
                  id="slotLabels"
                  type="text"
                  placeholder="Mon 4pm, Wed 5pm, Fri 2pm"
                  value={form.slotLabels}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slotLabels: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition duration-150 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Posting…" : "Post listing"}
              </button>
            </form>
          </section>

          {/* Listings column */}
          <section>
            {loadError && (
              <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{loadError}</span>
                <button
                  onClick={loadListings}
                  className="font-semibold underline underline-offset-2 transition duration-150 hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            )}

            {listings === null && !loadError && (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6"
                  >
                    <div className="h-4 w-1/3 rounded bg-zinc-200" />
                    <div className="mt-3 h-3 w-1/4 rounded bg-zinc-200" />
                    <div className="mt-4 h-3 w-full rounded bg-zinc-100" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100" />
                  </div>
                ))}
              </div>
            )}

            {listings !== null && listings.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
                <p className="text-base font-semibold text-zinc-900">
                  No tutors posted yet
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Be the first — post a listing on the left and students on
                  campus will be able to book time with you.
                </p>
              </div>
            )}

            {listings !== null && listings.length > 0 && (
              <ul className="space-y-4">
                {listings.map((listing) => {
                  const openSlots = listing.slots.filter((s) => !s.booked);
                  return (
                    <li
                      key={listing.id}
                      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-base font-semibold text-zinc-900">
                            {listing.subject}
                          </h3>
                          <p className="mt-0.5 text-sm text-zinc-500">
                            with {listing.tutorName}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="whitespace-nowrap rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                            ${listing.hourlyRate}/hr
                          </span>
                          <button
                            onClick={() => handleDelete(listing.id)}
                            disabled={deletingId === listing.id}
                            aria-label={`Delete ${listing.subject} listing`}
                            className="text-xs font-medium text-zinc-400 transition duration-150 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
                          >
                            {deletingId === listing.id ? "Removing…" : "Delete"}
                          </button>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-zinc-600">
                        {listing.description}
                      </p>

                      <div className="mt-5 border-t border-zinc-100 pt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Available times
                          </p>
                          {openSlots.length === 0 && (
                            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                              Fully booked
                            </span>
                          )}
                        </div>

                        <ul className="flex flex-wrap gap-2">
                          {listing.slots.map((slot) => {
                            const key = `${listing.id}:${slot.id}`;
                            const isActive = activeSlotKey === key;

                            if (slot.booked) {
                              return (
                                <li key={slot.id}>
                                  <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 line-through decoration-zinc-300">
                                    {slot.label}
                                  </span>
                                </li>
                              );
                            }

                            return (
                              <li key={slot.id} className="relative">
                                <button
                                  onClick={() => {
                                    setActiveSlotKey(isActive ? null : key);
                                    setBookingError(null);
                                    setBookingName("");
                                  }}
                                  className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                                    isActive
                                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                      : "border-zinc-200 text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                                  }`}
                                >
                                  {slot.label}
                                </button>

                                {isActive && (
                                  <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-4 shadow-md">
                                    <label
                                      htmlFor={`name-${key}`}
                                      className="text-xs font-medium text-zinc-600"
                                    >
                                      Your name to confirm booking
                                    </label>
                                    <input
                                      id={`name-${key}`}
                                      type="text"
                                      autoFocus
                                      value={bookingName}
                                      onChange={(e) =>
                                        setBookingName(e.target.value)
                                      }
                                      placeholder="Jordan Lee"
                                      className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 outline-none transition duration-150 focus:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                    />
                                    {bookingError && (
                                      <p className="mt-1.5 text-xs text-red-600">
                                        {bookingError}
                                      </p>
                                    )}
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        onClick={() =>
                                          handleBook(listing.id, slot.id)
                                        }
                                        disabled={bookingLoadingKey === key}
                                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition duration-150 hover:bg-indigo-500 disabled:opacity-60"
                                      >
                                        {bookingLoadingKey === key
                                          ? "Booking…"
                                          : "Confirm"}
                                      </button>
                                      <button
                                        onClick={() => setActiveSlotKey(null)}
                                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition duration-150 hover:bg-zinc-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
