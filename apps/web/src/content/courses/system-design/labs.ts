/** The architecture-lab scenarios a chapter can embed (see `lib/architecture-lab/scenarios`). */
export type LabId =
  | "url-shortener"
  | "ticket-booking"
  | "rag-assistant"
  | "tool-using-agent"
  | "safe-deployment"
  | "brokerage-order"
  | "video-streaming"
  | "ride-dispatch";

/** What the reader is asked to build in each lab, shown just above it. */
export const labIntroductions: Record<LabId, string> = {
  "url-shortener": "A redirect path is read-heavy. Place the minimum components needed to create a collision-safe key, preserve the mapping and make repeat redirects quick. More than one arrangement can pass if every responsibility is covered.",
  "ticket-booking": "Two buyers are racing for the final seat. Compose a path that lets people browse quickly but makes one authoritative operation choose the winner. The checker looks for responsibilities, not a vendor-specific diagram.",
  "rag-assistant": "A useful answer needs authorised evidence before generation. Build the path from source content to retrieval to a cited answer, keeping private documents out of the wrong user's context.",
  "tool-using-agent": "The model may propose an action, but it must not become a real side effect without validation and permission. Assemble a bounded tool loop with an observation path and a clear stop.",
  "safe-deployment": "A release must move from a tested artifact to a small slice of traffic before reaching everyone. Place the controls that make rollback faster than debugging under pressure.",
  "brokerage-order": "A customer order must pass validation, risk checks and an exchange boundary exactly once. Build a path that preserves an auditable state even when acknowledgements arrive late.",
  "video-streaming": "A viewer should fetch a small playlist and nearby media segments instead of one enormous file from an application server. Separate upload processing from worldwide playback.",
  "ride-dispatch": "A rider request needs fresh nearby-driver candidates, but the final assignment needs one winner. Separate approximate location search from the authoritative trip state change.",
};

