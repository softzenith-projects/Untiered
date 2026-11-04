import { ImageResponse } from "next/og";

export const alt = "Untiered: spoken AI mock interviews with a report that quotes what you said";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview shown when a public page is shared. Colours are the light theme's navy tokens. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        backgroundColor: "#142449",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700, color: "#b9d0ff" }}>Untiered</div>
      <div style={{ marginTop: 28, fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>They judged your college. Let&apos;s judge your answers.</div>
      <div style={{ marginTop: 28, fontSize: 34, color: "#b9d0ff" }}>Talent has no tiers. Practise with Krivih, our AI interviewer.</div>
    </div>,
    size,
  );
}
