import { describe, expect, it } from "vitest";

import { displayNameFor, nameFromEmail } from "./display-name";

describe("nameFromEmail", () => {
  it.each([
    ["naman.kaushik06@gmail.com", "Naman Kaushik"],
    ["ritik_bhardwaj@example.com", "Ritik Bhardwaj"],
    ["priya-sharma+jobs@example.com", "Priya Sharma"],
    ["ANANYA@example.com", "Ananya"],
    ["rahul1998@example.com", "Rahul"],
  ])("reads %s as %s", (email, name) => {
    expect(nameFromEmail(email)).toBe(name);
  });

  it.each(["12345@example.com", "a.b@example.com", "x9y2@example.com", "", null])(
    "gives up on %s rather than inventing a name",
    (email) => {
      expect(nameFromEmail(email)).toBeNull();
    },
  );
});

describe("displayNameFor", () => {
  it("prefers the name they gave", () => {
    expect(displayNameFor({ displayName: "Naman Kaushik", email: "nk@example.com" })).toBe("Naman Kaushik");
  });

  it("falls back to a guess from the email, then to the email itself", () => {
    expect(displayNameFor({ displayName: null, email: "naman.kaushik06@gmail.com" })).toBe("Naman Kaushik");
    expect(displayNameFor({ displayName: "  ", email: "12345@example.com" })).toBe("12345@example.com");
  });
});
