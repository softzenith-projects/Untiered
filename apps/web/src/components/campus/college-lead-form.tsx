"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type FormEvent } from "react";

import { TurnstileChallenge } from "@/components/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, FieldError, FieldHint, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { ApiRequestError, submitCollegeLead } from "@/lib/api";
import type { LeadRole } from "@untiered/shared";

type Field =
  | "collegeName"
  | "city"
  | "state"
  | "contactName"
  | "contactRole"
  | "email"
  | "phone"
  | "approxStudents"
  | "message"
  | "consentToContact";

type Values = Record<Exclude<Field, "consentToContact">, string> & { consentToContact: boolean };

const EMPTY: Values = {
  collegeName: "",
  city: "",
  state: "",
  contactName: "",
  contactRole: "",
  email: "",
  phone: "",
  approxStudents: "",
  message: "",
  consentToContact: false,
};

const ROLES: { value: LeadRole; label: string }[] = [
  { value: "tpo", label: "Placement officer (TPO)" },
  { value: "faculty", label: "Faculty" },
  { value: "college_admin", label: "College administration" },
  { value: "other", label: "Other" },
];

const ORDER: Field[] = [
  "collegeName",
  "city",
  "state",
  "contactName",
  "contactRole",
  "email",
  "phone",
  "approxStudents",
  "message",
  "consentToContact",
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9 +()-]+$/;

/** The same rules the API applies (LeadValidation), so most mistakes are caught before sending. */
export function validateLead(values: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const length = (value: string) => value.trim().replace(/\s+/g, " ").length;
  if (length(values.collegeName) < 2 || length(values.collegeName) > 200) errors.collegeName = "Enter your college's name.";
  if (length(values.city) < 1 || length(values.city) > 120) errors.city = "Enter the city.";
  if (length(values.state) < 1 || length(values.state) > 120) errors.state = "Enter the state.";
  if (length(values.contactName) < 1 || length(values.contactName) > 200) errors.contactName = "Enter your name.";
  if (!ROLES.some((role) => role.value === values.contactRole)) errors.contactRole = "Choose your role.";
  const email = values.email.trim();
  if (!EMAIL.test(email) || email.length > 320) errors.email = "Enter a valid email address.";
  const phone = values.phone.trim();
  if (phone && (phone.length > 20 || !PHONE.test(phone))) {
    errors.phone = "Use up to 20 digits, spaces or + - ( ).";
  }
  const students = values.approxStudents.trim();
  if (students) {
    const count = Number(students);
    if (!Number.isInteger(count) || count < 1 || count > 100_000) errors.approxStudents = "Enter a whole number from 1 to 100,000.";
  }
  if (values.message.trim().length > 2000) errors.message = "Keep the message under 2,000 characters.";
  if (!values.consentToContact) errors.consentToContact = "Tick this box so we can reply to you.";
  return errors;
}

/** The API's `lead_invalid` message starts with the field it is about. */
function fieldOf(message: string): Field | null {
  const name = message.split(":", 1)[0] as Field;
  return ORDER.includes(name) ? name : null;
}

/**
 * "Register your college" on /colleges (contract Module 13). Sends a lead and nothing else:
 * no account, no access. The honeypot is a text input people never see or reach; bots that
 * fill every field fill it too, and the API then accepts the form and drops it.
 */
export function CollegeLeadForm() {
  const id = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [checked, setChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const onToken = useCallback((next: string | null) => setToken(next), []);

  function set<K extends keyof Values>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a submit has shown the errors, each field clears its own as it is fixed.
    if (checked) setErrors(validateLead(next));
  }

  function focusFirst(found: Partial<Record<Field, string>>) {
    const first = ORDER.find((field) => found[field]);
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    setFormError(null);
    const found = validateLead(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirst(found);
      return;
    }
    if (siteKey && !token) {
      setFormError("Complete the security check, then send the form.");
      return;
    }
    setPending(true);
    try {
      const students = values.approxStudents.trim();
      await submitCollegeLead({
        collegeName: values.collegeName.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        contactName: values.contactName.trim(),
        contactRole: values.contactRole as LeadRole,
        email: values.email.trim(),
        phone: values.phone.trim() || null,
        approxStudents: students ? Number(students) : null,
        message: values.message.trim() || null,
        consentToContact: true,
        turnstileToken: token ?? "",
        website: honeypot.current?.value ?? "",
      });
      setSent(true);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "lead_invalid") {
        const field = fieldOf(cause.message);
        if (field) {
          const found = { [field]: cause.message.slice(field.length + 1).trim() };
          setErrors(found);
          focusFirst(found);
        } else {
          setFormError(cause.message);
        }
      } else if (cause instanceof ApiRequestError && cause.code === "turnstile_failed") {
        setFormError("The security check did not pass. Complete it again, then send the form.");
      } else if (cause instanceof ApiRequestError && cause.status === 429) {
        setFormError("This form has been sent a few times already. Try again later, or write to us instead.");
      } else {
        setFormError("The form could not be sent just now. Try again in a moment.");
      }
      // A Turnstile token works once; draw a new one for the next attempt.
      if (siteKey) {
        setToken(null);
        setChallengeAttempt((value) => value + 1);
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl border border-positive/25 bg-positive-wash p-6 text-ink">
        <p className="text-heading font-bold">We have your details.</p>
        <p className="text-body text-ink-muted">Thanks — someone from our team will contact you within a few working days.</p>
      </div>
    );
  }

  const describe = (field: Field, hint?: boolean) =>
    [hint ? `${id}-${field}-hint` : null, errors[field] ? `${id}-${field}-error` : null].filter(Boolean).join(" ") || undefined;
  const error = (field: Field) => (errors[field] ? <FieldError id={`${id}-${field}-error`}>{errors[field]}</FieldError> : null);
  const textField = (field: Exclude<Field, "contactRole" | "message" | "consentToContact">, label: string, extra: object = {}) => (
    <div>
      <FieldLabel htmlFor={`${id}-${field}`}>{label}</FieldLabel>
      <Input
        id={`${id}-${field}`}
        name={field}
        value={values[field]}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describe(field)}
        onChange={(event) => set(field, event.target.value)}
        {...extra}
      />
      {error(field)}
    </div>
  );

  return (
    <form ref={form} onSubmit={submit} noValidate aria-label="Register your college" className="relative grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">{textField("collegeName", "College name", { autoComplete: "organization", required: true })}</div>
      {textField("city", "City", { autoComplete: "address-level2", required: true })}
      {textField("state", "State", { autoComplete: "address-level1", required: true })}
      {textField("contactName", "Your name", { autoComplete: "name", required: true })}
      <div>
        <FieldLabel htmlFor={`${id}-contactRole`}>Your role</FieldLabel>
        <Select
          id={`${id}-contactRole`}
          name="contactRole"
          required
          value={values.contactRole}
          aria-invalid={errors.contactRole ? true : undefined}
          aria-describedby={describe("contactRole")}
          onChange={(event) => set("contactRole", event.target.value)}
        >
          <option value="">Choose one</option>
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
        {error("contactRole")}
      </div>
      {textField("email", "Work email", { type: "email", autoComplete: "email", required: true })}
      <div>
        <FieldLabel htmlFor={`${id}-phone`}>Phone (optional)</FieldLabel>
        <Input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describe("phone")}
          onChange={(event) => set("phone", event.target.value)}
        />
        {error("phone")}
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-approxStudents`}>Students in your final-year batches, roughly (optional)</FieldLabel>
        <Input
          id={`${id}-approxStudents`}
          name="approxStudents"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          className="sm:max-w-48"
          value={values.approxStudents}
          aria-invalid={errors.approxStudents ? true : undefined}
          aria-describedby={describe("approxStudents")}
          onChange={(event) => set("approxStudents", event.target.value)}
        />
        {error("approxStudents")}
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-message`}>Anything we should know (optional)</FieldLabel>
        <Textarea
          id={`${id}-message`}
          name="message"
          rows={4}
          maxLength={2000}
          value={values.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describe("message", true)}
          onChange={(event) => set("message", event.target.value)}
        />
        <FieldHint id={`${id}-message-hint`}>For example, the batches you would start with, or when your placement season begins.</FieldHint>
        {error("message")}
      </div>

      {/* Honeypot. Off-screen, out of the tab order and hidden from assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto size-px overflow-hidden" data-testid="lead-honeypot">
        <label htmlFor={`${id}-website`}>Website</label>
        <input ref={honeypot} id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="sm:col-span-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${id}-consent`}
            name="consentToContact"
            checked={values.consentToContact}
            aria-invalid={errors.consentToContact ? true : undefined}
            aria-describedby={describe("consentToContact")}
            onChange={(event) => set("consentToContact", event.target.checked)}
            className="mt-0.5"
          />
          <label htmlFor={`${id}-consent`} className="text-body text-ink">
            You may contact me about Untiered Campus
          </label>
        </div>
        {error("consentToContact")}
        <p className="mt-3 text-caption text-ink-muted">
          We use these details only to reply to you about Untiered Campus. If it turns out not to be a fit, we delete them within six
          months. See our{" "}
          <Link href={"/privacy" as Route} className="font-medium text-accent hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>

      {siteKey ? (
        <div className="sm:col-span-2">
          <TurnstileChallenge key={challengeAttempt} siteKey={siteKey} onToken={onToken} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:col-span-2">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <div>
          <Button type="submit" size="lg" loading={pending}>
            Register your college
          </Button>
        </div>
      </div>
    </form>
  );
}
