import type { ChapterSource } from "@/content/courses/system-design/lesson";

export const cases: ChapterSource[] = [
  {
    slug: "case-url-shortener",
    title: "Case: A URL Shortening Service",
    summary: "Create short keys, redirect quickly and handle popular links without inventing complexity.",
    intro: [
      "A URL shortener turns a long web address into a short one, such as `sho.rt/k3Fq9`. Open the short address and you are sent on to the long one. The system has two jobs: create a link, and follow a link. Creating is rare. Following happens constantly, because every click, share and reload is a follow.",
      "That imbalance shapes the whole design. A link might be created once and followed a million times, so the follow path must be very fast and the create path must be careful. The hard parts are small but real: every key must be unique, a hugely popular link must not overload one machine, and keys must not be so easy to guess that strangers can walk through everyone's links.",
    ],
    analogy: [
      "A cloakroom ticket",
      "A small numbered ticket stands for one bulky coat. The ticket must be unique, handing over the coat must be quick, and a ticket nobody can guess keeps other people's coats safe.",
    ],
    glossary: [
      ["short key", "The few characters at the end of a short link, which identify one stored destination."],
      ["redirect", "A reply that tells the browser to go to a different address."],
      ["key space", "The total number of different keys that can exist at a given key length."],
      ["collision", "Two different links being given the same key by mistake."],
      ["hot link", "A single link that receives far more clicks than the average."],
    ],
    walkthrough: {
      title: "Follow one short link from creation to click",
      steps: [
        { label: "Create the key", text: "A user submits a long article address. The service makes a random 7-character key, and the database refuses to store it if that key already exists, in which case a new key is made." },
        { label: "Store the mapping", text: "The key and the long address are saved, along with an optional expiry date and the owner. The user gets `sho.rt/k3Fq9` back." },
        { label: "Click: check the cache", text: "Someone opens the short link. The redirect service looks the key up in a cache first, because the same popular keys are read again and again." },
        { label: "Redirect or miss", text: "On a hit it replies with the redirect at once. On a miss it reads the database, fills the cache and then replies. An unknown or expired key gets a clear not-found page." },
      ],
    },
    example: {
      title: "Worked example: how long must the key be?",
      text: "Suppose the service creates 100 million links a year and must keep them for five years: 500 million keys. Keys use 62 characters (a-z, A-Z, 0-9). Six characters give 62^6, about 56 billion combinations. Seven give about 3.5 trillion. At 500 million used out of 3.5 trillion, a random 7-character key collides on roughly 0.014% of attempts, so a retry on collision is rare and cheap. Six characters would be about 1% full, which also works but leaves less room to grow. On the read side, if each link is followed 100 times on average, that is 50 billion redirects over five years, around 300 per second on average and several times that at peak. This is easily handled by a cache in front of the database.",
    },
    tradeoff: {
      title: "Random keys or counter keys",
      gain: {
        label: "Random keys gain",
        items: [
          "Strangers cannot guess the next link from the last one",
          "Many servers can create keys at once with no shared counter",
          "No hidden order that reveals how many links exist",
        ],
      },
      cost: {
        label: "Random keys cost",
        items: [
          "A collision is possible, so the database must check and the service must retry",
          "Keys cannot be sorted by creation time",
          "Slightly longer keys are needed for the same room as a counter",
        ],
      },
    },
    lab: "url-shortener",
    pitfalls: [
      "Using a plain counter for keys and never discussing guessing. Anyone can try `…/1001`, `…/1002` and read other people's links.",
      "Checking for an existing key and then inserting in two steps, so two requests can both pass the check and one overwrites the other.",
      "Counting every click by writing to the same database row as the redirect lookup, which slows down the most important path.",
    ],
    remember: [
      "Redirects dominate. Optimise the read path first.",
      "Keys must be unique by rule: the database should refuse duplicates, not just hope.",
      "Cache hot keys, and send an expired key a clear answer.",
      "Handle click statistics off the redirect path.",
    ],
    interview: [
      "Estimate the key length and the redirect rate out loud, then spend your depth on collisions and cache misses.",
      "Ask whether custom aliases, expiry and analytics are in scope before drawing anything.",
    ],
    quizzes: [
      {
        question: "Two requests generate the same random key at the same moment. How does a safe design stop one link overwriting the other?",
        options: [
          "The first request holds a lock on every key until the second one has completely finished",
          "The database enforces a unique key, so the second insert fails and is retried",
          "The cache keeps only the most recent link for each short key",
          "Keys are made longer automatically after every collision happens",
        ],
        answer: 1,
        why: "A uniqueness rule inside the database is checked atomically, so only one insert wins. The loser gets an error and tries a fresh key.",
      },
      {
        question: "One shared link goes viral and gets thousands of clicks a second. What protects the database?",
        options: [
          "A counter added to every click to share the load",
          "A longer key so that the link is harder to overload",
          "A cache, so most clicks never reach the database",
          "A new short key created for every visitor who clicks",
        ],
        answer: 2,
        why: "The mapping from key to destination hardly ever changes, so a cache can answer almost every click. The database then sees only the occasional miss.",
      },
      {
        question: "Why is a simple counter risky as the source of short keys?",
        options: [
          "A counter can never produce more than a few thousand keys",
          "Anyone can guess neighbouring keys and read other people's links",
          "Numbers cannot be stored reliably in a database column",
          "Keys made of digits cannot be used in a redirect",
        ],
        answer: 1,
        why: "Consecutive keys are easy to guess, so a visitor can walk through every link. Random keys make guessing impractical.",
      },
    ],
  },
  {
    slug: "case-collaborative-editor",
    title: "Case: A Collaborative Document Editor",
    summary: "Synchronise edits, presence and durable snapshots across unreliable connections.",
    intro: [
      "In a collaborative editor, several people type into the same document at once and everyone sees the same result. Each person's screen applies their own typing instantly, then learns about the others' changes a moment later. Cursors and \"who is here\" avatars sit on top of that.",
      "The difficulty is that two people can change the same place at the same time, over networks that are slow or drop out. If the system simply applies edits in arrival order, different people can end up with different documents. The design must make sure everyone converges to the same text, and that someone who was offline can come back without erasing the work done while they were away.",
    ],
    analogy: [
      "Sticky notes on a shared board",
      "Everyone can add or move notes at once and sees the others' changes appear. If you leave the room and return, you must be able to see what changed in your absence, and your own notes must not vanish because someone else rearranged the board.",
    ],
    glossary: [
      ["operation", "A small description of one edit, such as inserting a letter at a position, which can be sent and replayed."],
      ["concurrent edits", "Edits made by different people at the same time, before either has seen the other."],
      ["convergence", "The guarantee that everyone ends up with exactly the same document once all edits have arrived."],
      ["presence", "Short-lived information such as who is online and where their cursor is."],
      ["snapshot", "A saved copy of the whole document at one moment, used so loading does not replay every edit ever made."],
    ],
    walkthrough: {
      title: "Follow two people typing in the same sentence",
      steps: [
        { label: "Edit locally first", text: "Asha and Ben both see the word \"cat\". Asha types an \"s\" at the end while Ben types \"b\" at the start. Each sees their own letter immediately, without waiting for the network." },
        { label: "Send the operations", text: "Each browser sends its edit as a small operation over a live connection. Each operation says what was changed and which version of the document it was based on." },
        { label: "Merge", text: "The server receives both and applies a merge rule so that the results agree. Ben's insert at position 0 shifts where Asha's insert lands, and both end with \"bcats\" on their screens. The server then broadcasts the merged result." },
        { label: "Save and resync", text: "The server appends the operations to a log and writes a snapshot every so often. If Ben's train goes into a tunnel, his browser keeps his edits, then on reconnecting asks for everything after his last known version." },
      ],
    },
    example: {
      title: "Worked example: why whole-document sends fail",
      text: "Imagine a 50 KB document with ten people typing about two characters a second each. If every keystroke sent the whole document to every person, that is 20 keystrokes a second x 50 KB x 10 recipients, about 10 MB per second, just to move twenty letters. Sending operations of around 50 bytes each brings the same traffic down to roughly 10 KB per second, a thousand times less. It also solves a correctness problem: sending whole copies means the last copy to arrive overwrites everyone else's recent typing. A small operation says what changed, so it can be combined with other changes instead of replacing them.",
    },
    tradeoff: {
      title: "Merging edits or locking the document",
      gain: {
        label: "Live merging gains",
        items: [
          "Everyone can type at once with no waiting for a turn",
          "Offline work can be merged on return",
          "Small messages keep the network cost low",
        ],
      },
      cost: {
        label: "Live merging costs",
        items: [
          "The merge rules are subtle and need careful testing",
          "History and snapshots must be stored and trimmed",
          "Permissions and size limits need extra care on a live channel",
        ],
      },
    },
    pitfalls: [
      "Broadcasting the whole document on each keystroke, which is slow and lets the last sender erase others' typing.",
      "Storing cursor positions in the document itself, so temporary presence data becomes permanent content.",
      "Having no plan for a client that was offline, so reconnecting either loses its edits or overwrites others'.",
    ],
    remember: [
      "Send small operations, not whole documents.",
      "The goal is convergence: everyone ends with the same text.",
      "Presence is short-lived. The document is durable. Keep them apart.",
      "Save snapshots so loading does not replay all history.",
    ],
    interview: [
      "Walk through two users typing at the same position while one disconnects and then reconnects.",
      "State which guarantee your merge model gives and what it needs from the server.",
    ],
    quizzes: [
      {
        question: "Two people edit the same word at the same moment. Which design gives them the same final text?",
        options: [
          "Whichever edit reaches the server last replaces the whole document",
          "Each browser keeps its own version and never syncs with others",
          "Only the first person to open the document is allowed to type",
          "A merge rule that combines both edits in a consistent way",
        ],
        answer: 3,
        why: "A shared merge rule lets every client reach the same result whatever the arrival order. Last-writer-wins would erase one person's typing.",
      },
      {
        question: "A user's laptop loses Wi-Fi for two minutes and reconnects. What should the client do?",
        options: [
          "Reload the document and discard what it typed while offline",
          "Send its whole local copy to replace the server's version",
          "Ask for operations after its last known version and merge its own",
          "Wait until every other editor has left before syncing again",
        ],
        answer: 2,
        why: "Asking for what it missed lets it catch up, and merging its local edits keeps the offline work. Discarding or overwriting would lose someone's changes.",
      },
      {
        question: "Why are cursor positions kept out of the saved document history?",
        options: [
          "Cursors are too large to be stored in any database",
          "Cursor positions cannot be sent over a live connection",
          "Merge rules cannot work with numbers such as cursor positions in a text",
          "They are short-lived and would clutter the permanent record",
        ],
        answer: 3,
        why: "Cursors are short-lived and useless a minute later, so storing them forever wastes space and mixes disposable data with the document.",
      },
    ],
  },
  {
    slug: "case-ticket-booking",
    title: "Case: A Ticket Booking Platform",
    summary: "Search events broadly, then protect scarce seats during a timed checkout.",
    intro: [
      "A ticket booking platform has two very different halves. Browsing events is a huge, forgiving read workload: many people search, filter and look at seat maps. Buying a seat is a small, strict write workload: one seat can be sold to exactly one person, and many people may want it at the same instant.",
      "Treating both halves the same way is the classic mistake. If browsing runs on copies that are a few seconds old, nothing bad happens. If buying runs on those copies, two people are told they got the same seat. The design keeps the fast, loose reads separate from a tightly controlled booking path, and uses a short timed hold so a seat is reserved while the buyer pays.",
    ],
    analogy: [
      "A shopkeeper who holds one item briefly",
      "The shopkeeper puts the last jacket behind the counter while you fetch your wallet. If you do not come back in ten minutes, the jacket goes back on the shelf for the next customer.",
    ],
    glossary: [
      ["seat hold", "A temporary reservation that keeps a seat for one buyer for a few minutes while they pay."],
      ["atomic update", "A change that either happens completely or not at all, with no other change able to slip in halfway."],
      ["idempotent payment", "A payment step that can be repeated safely because the repeat is recognised and has no extra effect."],
      ["waiting room", "A queue that admits buyers gradually when demand is far higher than the system can serve."],
      ["inventory", "The authoritative record of which seats are free, held or sold."],
    ],
    walkthrough: {
      title: "Follow two buyers racing for the last seat",
      steps: [
        { label: "Browse on copies", text: "Both buyers see seat 12C marked free on a seat map built from a cached read model. This is fine for looking, but it is only a hint." },
        { label: "Try to hold", text: "Both press \"Buy\". The inventory service runs one conditional update: set seat 12C to HELD by this buyer until 6:15, only if it is currently FREE. The database applies one of the two updates first." },
        { label: "One winner", text: "The first update succeeds and the second finds the seat already HELD, so it changes nothing. That buyer is told the seat was just taken and is shown other seats." },
        { label: "Pay and confirm, or release", text: "The winner pays. The payment callback marks the seat SOLD, and a repeated callback is recognised by its key and ignored. If the 6:15 deadline passes first, a cleanup job returns the seat to FREE." },
      ],
    },
    example: {
      title: "Worked example: a sale that opens at noon",
      text: "A concert has 20,000 seats, and 200,000 people arrive at noon. Without protection, 200,000 people hit the booking path at once, and holds and payments time out for all of them. A waiting room admits, say, 2,000 buyers at a time, giving the booking path steady load. If each buyer's hold lasts 8 minutes, the hold must be stored with its expiry time inside the inventory record, so every server agrees. If the cleanup job runs once a minute, a seat might stay held for up to a minute after expiry, so the booking rule also treats an expired hold as free at the moment of the check.",
    },
    tradeoff: {
      title: "Holding seats while buyers pay",
      gain: {
        label: "Timed holds gain",
        items: [
          "A buyer cannot lose a seat halfway through typing card details",
          "Abandoned checkouts free their seats automatically",
          "Each seat has one clear owner at any moment",
        ],
      },
      cost: {
        label: "Timed holds cost",
        items: [
          "Held seats look unavailable to others who would have bought them",
          "Expiry and payment can race, so edge cases need explicit rules",
          "Bots can hold seats without buying unless limits are in place",
        ],
      },
    },
    pitfalls: [
      "Trusting the cached seat map as proof that a seat can be bought. Only the inventory source can say.",
      "Reading a seat's state and then writing it in two steps, so both buyers pass the read.",
      "Treating a repeated payment callback as a new payment and selling or charging twice.",
    ],
    remember: [
      "Browsing may use slightly old copies. Booking must use the source of truth.",
      "Make \"free to held\" one atomic, conditional update.",
      "Store the hold's expiry with the seat and handle the payment-versus-expiry race.",
      "Protect the system from the opening-minute flood.",
    ],
    interview: [
      "Draw two buyers racing for one seat and point to the single operation that picks the winner.",
      "Explain what happens if payment succeeds just after the hold expires.",
    ],
    quizzes: [
      {
        question: "Two buyers press Buy on the same seat in the same millisecond. What guarantees only one of them gets it?",
        options: [
          "Showing the cached seat map to both buyers at once",
          "A conditional update that succeeds only while the seat is free",
          "Sending both buyers a confirmation, then fixing the clash later by email",
          "Making the second buyer wait ten minutes before trying",
        ],
        answer: 1,
        why: "A conditional atomic update lets the database serialise the two attempts, so exactly one finds the seat free. Cached maps cannot decide who wins.",
      },
      {
        question: "A payment callback arrives twice for the same order. How should the system treat the second one?",
        options: [
          "Mark a second seat as sold for the same order",
          "Charge the customer a second time to be safe",
          "Release the seat so another buyer can take it",
          "Recognise its key and ignore it, as the order is confirmed",
        ],
        answer: 3,
        why: "Callbacks are often repeated, so confirmation must be idempotent. A stored key shows the order is already done.",
      },
      {
        question: "Why is a waiting room useful when a hugely popular sale opens?",
        options: [
          "It makes tickets cheaper for people who are waiting near the back of the line",
          "It lets the seat map display events not yet on sale",
          "It admits buyers at a steady rate so booking stays responsive",
          "It removes the need for holds because nobody competes",
        ],
        answer: 2,
        why: "A flood of simultaneous buyers can overload the strict booking path. Admitting them gradually keeps it fast and correct for those inside.",
      },
    ],
  },
  {
    slug: "case-personalised-feed",
    title: "Case: A Personalised Feed",
    summary: "Combine candidate generation, ranking and fan-out under a freshness budget.",
    intro: [
      "A personalised feed shows each person a list of posts picked for them. Behind the scenes it answers three questions: which posts could this person see, which of those are best, and how do we show them page by page without repeats. The list is different for every user and changes as new posts arrive.",
      "The cost is in the multiplying. A creator with a million followers who posts once creates a million feed updates if you do the work at write time. A user who opens the app a hundred times a day triggers a hundred rebuilds if you do the work at read time. The design is about choosing where to spend that work, how stale a feed may be, and keeping pages stable while the list underneath keeps changing.",
    ],
    analogy: [
      "A morning newspaper made for one reader",
      "Editors gather possible stories, rank them for this reader, and print only the best few pages. Breaking news can be slipped in at the last moment, rather than reprinting the entire archive each morning.",
    ],
    glossary: [
      ["candidate generation", "Collecting a few hundred possible posts for a user, from people they follow and other sources."],
      ["ranking", "Ordering candidates by how useful they are likely to be for this particular user."],
      ["fan-out on write", "Copying a new post into each follower's prepared feed at the moment it is published."],
      ["fan-out on read", "Collecting the posts from everyone a user follows at the moment they open the app."],
      ["cursor", "A marker that says where the last page ended, so the next page continues from the same place."],
    ],
    walkthrough: {
      title: "Follow one user opening the app",
      steps: [
        { label: "Fetch the prepared list", text: "A user opens the feed. The service reads their prepared feed, a list of recent post IDs that was filled when their friends posted." },
        { label: "Add the big accounts", text: "A few accounts they follow have millions of followers, so those posts are not pre-copied. The service pulls their latest posts directly and merges them into the list." },
        { label: "Filter and rank", text: "Posts the user has hidden, muted or is not allowed to see are removed. The remaining couple of hundred are ranked, and only the top 20 are prepared in full." },
        { label: "Return a stable page", text: "The reply includes the 20 posts and a cursor holding the last post's score and ID. Scrolling down uses that cursor, so a post published meanwhile does not push earlier posts onto the next page again." },
      ],
    },
    example: {
      title: "Worked example: fan-out for two kinds of creator",
      text: "A creator with 300 followers posts once. Fan-out on write means 300 small writes, which is trivial, and each follower's feed is ready to read. A creator with 5 million followers posts once. Fan-out on write means 5 million writes for one post, and a minute-long delay before the last follower sees it. Instead the service keeps that creator's posts in one place and merges them in at read time: each reader does one extra lookup. Use write-time copying for ordinary creators, and read-time merging for the few accounts with huge audiences. That mixed approach keeps both costs small.",
    },
    tradeoff: {
      title: "Where to do the feed work",
      gain: {
        label: "Doing work at write time gains",
        items: [
          "Opening the feed is just reading a prepared list",
          "Ranking can use a short, ready-made candidate set",
          "Steady, predictable read latency",
        ],
      },
      cost: {
        label: "Doing work at write time costs",
        items: [
          "One post becomes many writes, which is painful for huge accounts",
          "Stored feeds can hold deleted or hidden posts until cleaned",
          "More storage for copies nobody may read",
        ],
      },
    },
    artifact: {
      kind: "compare",
      title: "Where feed work happens",
      columns: [
        { label: "Fan-out on write", items: ["Fast reads", "More writes per post", "Poor fit for huge follower counts"] },
        { label: "Fan-out on read", items: ["Cheaper publishing", "More work at read time", "Useful for high-fan-out creators"] },
        { label: "Hybrid", items: ["Precompute ordinary creators", "Merge celebrity posts at read time", "More operational complexity"] },
      ],
    },
    pitfalls: [
      "Using page numbers or offsets on a list that changes, so new posts cause repeats or skipped items.",
      "Rebuilding the entire feed from scratch on each open, instead of using prepared candidates.",
      "Forgetting to remove posts when someone deletes them, blocks a user or changes privacy.",
    ],
    remember: [
      "Separate finding candidates from ranking them.",
      "Choose fan-out by follower count, not by habit.",
      "Page with a cursor, never a page number, on a changing list.",
      "Apply privacy and blocking at read time too.",
    ],
    interview: [
      "Compare fan-out on write with fan-out on read for an ordinary creator and a hugely popular one.",
      "Say how you keep a deleted post from showing up in someone's prepared feed.",
    ],
    quizzes: [
      {
        question: "A creator with eight million followers posts. Why is copying the post into every follower's feed a poor plan?",
        options: [
          "Followers' apps cannot display posts that were copied for them",
          "Posts must always be ranked before they can be published",
          "Prepared feeds are unable to store lists of post IDs",
          "One post becomes millions of writes, so read-time merging suits it better",
        ],
        answer: 3,
        why: "One post would turn into millions of writes, causing delay and load. Merging that creator's posts when a reader opens the feed spreads the cost thinly.",
      },
      {
        question: "A user scrolls with page numbers while new posts keep arriving. What problem appears?",
        options: [
          "The feed ends up being sorted alphabetically by the name of each author",
          "Posts shift between pages, so some repeat and others are skipped",
          "Each page loads more slowly than the one before it",
          "Ranking quietly stops working until the list is rebuilt",
        ],
        answer: 1,
        why: "Adding items at the top moves everything down, so page 2 now begins with what was at the end of page 1. A cursor anchors to a specific item instead.",
      },
      {
        question: "A user blocks someone, yet that person's posts still appear from the prepared feed. What should the read path do?",
        options: [
          "Wait until the prepared feeds are rebuilt in the overnight job",
          "Show them, because they were allowed at the moment they were copied",
          "Filter out blocked authors at read time, before ranking",
          "Rank them lower but keep showing them in the same feed",
        ],
        answer: 2,
        why: "Prepared copies go out of date when privacy changes. Checking at read time ensures a change takes effect straight away.",
      },
    ],
  },
  {
    slug: "case-chat-and-presence",
    title: "Case: Chat, Delivery and Presence",
    summary: "Deliver ordered conversations while treating online status as an approximate signal.",
    intro: [
      "A chat system keeps a long-lived connection to each user's device so messages can be pushed the moment they arrive. It stores every message, delivers it to the recipient's devices, and shows small signals such as sent, delivered and read, and whether a friend is online.",
      "Two truths shape the design. First, messages must not be lost, and within one conversation they must arrive in order, but a global order across all conversations is neither possible nor needed. Second, \"online\" is a guess. Phones lose signal without saying goodbye, so a presence dot is a hint that fades, never a fact to build anything important on.",
    ],
    analogy: [
      "Registered mail and a porch light",
      "A receipt proves the letter reached the mailbox. A lit porch light suggests someone is home, but it might have been left on, so you would not rely on it for anything that matters.",
    ],
    glossary: [
      ["connection gateway", "A server that holds the open connections to devices and passes messages between them and the rest of the system."],
      ["acknowledgement", "A short reply confirming that a message was received or stored."],
      ["sequence number", "A counter inside one conversation that fixes the order of its messages."],
      ["heartbeat", "A small regular signal from a device that says it is still connected."],
      ["push notification", "A message sent through the phone's operating system to wake or alert an app that is not connected."],
    ],
    walkthrough: {
      title: "Follow one message from Meera to Ravi",
      steps: [
        { label: "Send and store", text: "Meera's phone sends \"On my way\" through her gateway. The chat service gives it the next sequence number in that conversation, say 481, and saves it before replying." },
        { label: "Acknowledge", text: "Only after the message is stored does Meera's phone get a \"sent\" tick. If her phone retries because the reply was lost, the message ID shows it is a repeat and nothing is stored twice." },
        { label: "Deliver", text: "The service finds Ravi's open connections. His tablet is connected and gets the message at once; his phone is not, so a push notification goes out instead." },
        { label: "Delivered and read", text: "When Ravi's tablet confirms receipt, Meera sees \"delivered\". When Ravi opens the chat, a read marker up to message 481 is sent back. His phone later reconnects and asks for everything after the last number it holds." },
      ],
    },
    example: {
      title: "Worked example: how much presence traffic is too much",
      text: "Suppose 10 million users are online, and each device sends a heartbeat every 30 seconds. That is about 333,000 heartbeats a second just to say \"still here\". If each heartbeat also told all of a user's 200 contacts, the fan-out would be over 66 million updates a second, which no one needs. A sensible design stores a last-seen time with an expiry of, say, 90 seconds, and only tells contacts who currently have that user's chat open. If the expiry passes without a heartbeat, the user quietly appears offline. Because the dot is approximate, a few seconds of delay costs nothing.",
    },
    tradeoff: {
      title: "Strong ordering within a chat or one global order",
      gain: {
        label: "Order per conversation gains",
        items: [
          "Each chat is ordered by a single, simple counter",
          "Different chats can be handled by different servers",
          "Reconnecting devices need only the last number they saw",
        ],
      },
      cost: {
        label: "Order per conversation costs",
        items: [
          "Nothing orders messages across different chats",
          "One very busy group chat can overload its owning server",
          "Multiple devices need careful syncing of read state",
        ],
      },
    },
    pitfalls: [
      "Promising exactly-once delivery everywhere. Networks drop and repeat messages, so the practical goal is at-least-once with duplicates removed by ID.",
      "Treating presence as a durable fact, such as using \"offline\" to decide whether to charge or notify.",
      "Showing \"sent\" before the message is saved, so a server crash loses a message the sender thinks went through.",
    ],
    remember: [
      "Store first, then acknowledge.",
      "Order within a conversation. Do not chase a global order.",
      "Retries mean duplicates. Give each message a unique ID.",
      "Presence is approximate and expires.",
    ],
    interview: [
      "Explain the sent, delivered and read states, and what happens to them when a phone reconnects.",
      "Say why you would not promise exactly-once delivery, and how deduplication gives the same effect.",
    ],
    quizzes: [
      {
        question: "Meera's phone sends a message, the reply is lost, and it sends the same message again. How does a good design avoid showing it twice?",
        options: [
          "The server deletes Meera's older messages to make room",
          "The recipient's app is told to ignore every second message",
          "Meera is blocked from sending until the first reply arrives",
          "The message has a unique ID, so the repeat is recognised",
        ],
        answer: 3,
        why: "A unique ID lets the server see that the second copy is the same message. Retrying is safe because duplicates are dropped.",
      },
      {
        question: "Why does the server save a message before telling the sender it was sent?",
        options: [
          "A crash after the tick cannot lose a message the sender trusts",
          "Ticks cannot be displayed on a phone until storage is empty",
          "Storing first makes the message appear on screen sooner",
          "It lets presence information update before delivery happens",
        ],
        answer: 0,
        why: "A tick is a promise. If it is shown before saving, a failure in between makes the promise false.",
      },
      {
        question: "A phone enters a tunnel and stops sending heartbeats. What should presence show after a short while?",
        options: [
          "Online, and it stays that way until the user chooses to sign out again",
          "An error message shown to all of their contacts",
          "The exact time at which the signal was lost",
          "Offline, once the presence entry expires without a heartbeat",
        ],
        answer: 3,
        why: "Presence is built on expiry. When no heartbeat renews it, the entry lapses and the user appears offline.",
      },
    ],
  },
  {
    slug: "case-file-sync-and-sharing",
    title: "Case: File Sync and Sharing",
    summary: "Move chunks efficiently, retain versions and enforce access at every download.",
    intro: [
      "A file sync service keeps the same folder identical on several devices and lets people share files with others. When you change a file on your laptop, the change appears on your phone. When you share a file, the other person can open it, but only while you allow it.",
      "Two things make this harder than it looks. Files can be huge, and changing one line should not mean uploading the whole file again, so files are cut into chunks and only changed chunks move. And two devices can change the same file while one is offline, so the system must keep both versions rather than silently choose one. Access must also be checked on every download, not just when a link was created.",
    ],
    analogy: [
      "Numbered boxes instead of the whole house",
      "When you change one room, you only send the labelled boxes from that room. A packing list names which boxes make up the newest version, so anyone can rebuild the house exactly.",
    ],
    glossary: [
      ["chunk", "A fixed or variable-size slice of a file that is stored and transferred on its own."],
      ["hash", "A short fingerprint calculated from some bytes, which changes if the bytes change."],
      ["manifest", "A list of the chunk hashes, in order, that together make up one version of a file."],
      ["version", "One saved state of a file that can be restored later."],
      ["conflict copy", "An extra copy kept when two devices changed the same file and neither can be chosen safely."],
    ],
    walkthrough: {
      title: "Follow one edit from laptop to phone",
      steps: [
        { label: "Detect and chunk", text: "You edit the middle of a 200 MB presentation. The laptop client cuts the file into chunks, hashes each one, and sees that only 3 of the 100 chunk hashes differ from the last version." },
        { label: "Upload what is missing", text: "It asks the server which of the new hashes it lacks, and uploads just those 3 chunks. Uploads can be resumed if the Wi-Fi drops halfway." },
        { label: "Commit the version", text: "Once all chunks are stored, the server records a new manifest and bumps the file's version in one transaction. Until that moment, other devices still see the old, complete version." },
        { label: "Notify and download", text: "Your phone is told that a newer version exists, compares the manifest with what it holds, and downloads only the 3 changed chunks. If the phone had also edited the file, it would keep both as a conflict copy." },
      ],
    },
    example: {
      title: "Worked example: what chunking saves",
      text: "A 200 MB file is cut into 4 MB chunks, giving 50 chunks. You change a few slides and 3 chunks differ. Uploading the whole file moves 200 MB; uploading changed chunks moves 12 MB, about 6% of it. Now suppose two people store the same 50 MB video. Because chunks are named by their hash, the second upload finds every hash already present and moves nothing. That saving needs care: if the server says \"I already have that chunk\", a curious user could learn whether someone else holds a given file, so the check must be tied to what that user is allowed to know.",
    },
    tradeoff: {
      title: "Keeping every version or only the latest",
      gain: {
        label: "Keeping versions gains",
        items: [
          "People can recover from mistakes and bad overwrites",
          "A conflict never destroys anyone's work",
          "Sync can safely be retried, because old data is never edited in place",
        ],
      },
      cost: {
        label: "Keeping versions costs",
        items: [
          "More storage, needing retention rules and clean-up",
          "Deleted files must really disappear when asked, including old chunks",
          "Conflict copies need a way for users to resolve them",
        ],
      },
    },
    pitfalls: [
      "Overwriting a stored file in place, so a half-finished upload corrupts the only copy.",
      "Checking permission when a share link is made but not at each download, so revoked access keeps working.",
      "Letting duplicate-chunk checks reveal which files other users hold.",
    ],
    remember: [
      "Move chunks, not whole files.",
      "Stored chunks never change. A new version is a new manifest.",
      "Commit metadata in one step, so a version is either complete or absent.",
      "Check permission on every download.",
    ],
    interview: [
      "Trace a changed large file from local detection through to another device receiving it.",
      "Explain what happens when two devices edit the same file offline.",
    ],
    quizzes: [
      {
        question: "Only the middle of a large file changes. What does a chunk-based sync client upload?",
        options: [
          "The whole file, so that nothing can be missed",
          "Only the first chunk, since edits are usually at the top",
          "A list of changed words, which the server applies",
          "Only the chunks whose hashes the server does not have",
        ],
        answer: 3,
        why: "Chunk hashes show which parts are different. Only those parts need to travel, which makes small edits cheap.",
      },
      {
        question: "Two devices edit the same document while offline, then both reconnect. What is the safest behaviour?",
        options: [
          "Keep the version that was uploaded last and delete the other",
          "Keep both, marking one as a conflict copy",
          "Delete both and ask the user to start again",
          "Merge the two files automatically by guessing",
        ],
        answer: 1,
        why: "Either choice of winner would silently destroy work. Keeping both lets the user decide.",
      },
      {
        question: "The server only makes a new version visible after every chunk is stored. Why?",
        options: [
          "Chunks cannot be uploaded while the app is in the background",
          "It saves storage space on the user's phone",
          "No device should ever see a version with chunks missing",
          "It removes the need for hashing every chunk",
        ],
        answer: 2,
        why: "Committing the manifest last makes the version all-or-nothing, so no device downloads a file with holes in it.",
      },
    ],
  },
  {
    slug: "case-search-and-autocomplete",
    title: "Case: Search and Autocomplete",
    summary: "Serve typo-tolerant suggestions quickly while keeping ranking and permissions correct.",
    intro: [
      "Search has two parts that look alike but behave differently. Full search takes a finished query and returns ranked results. Autocomplete reacts to every keystroke and suggests what you might be about to type. Full search can take a few hundred milliseconds. Autocomplete has to feel instant, because a new request is sent as often as every letter.",
      "Both depend on an index, a structure built in advance that finds matches without reading every document. The index is a copy, so it is always slightly behind the real data, and it must respect who is allowed to see what. A suggestion is a tiny leak: if the dropdown shows the title of a private document, the user has learned it exists, even if they can never open it.",
    ],
    analogy: [
      "A helpful librarian who finishes your sentence",
      "After a few letters the librarian suggests likely titles. But before handing anything over, they still check which shelf it is on and whether you are allowed to borrow it.",
    ],
    glossary: [
      ["index", "A structure built in advance that finds matching items quickly without scanning everything."],
      ["prefix match", "Finding items that begin with the letters typed so far."],
      ["relevance", "How well a result fits what the user probably wants, used to order results."],
      ["typo tolerance", "Finding the right result even when the query has a small spelling mistake."],
      ["index lag", "The delay between a change in the real data and that change appearing in the index."],
    ],
    walkthrough: {
      title: "Follow one person typing \"inter\" into a search box",
      steps: [
        { label: "Keystroke arrives", text: "After a short pause of about 100 milliseconds, the browser sends \"inter\" to the suggestion service. Sending after the pause avoids one request per letter for fast typists." },
        { label: "Find prefix candidates", text: "The service looks \"inter\" up in a small, memory-friendly prefix index and gets a few dozen candidates, such as \"interview tips\" and \"internship letter\", each with a popularity score." },
        { label: "Filter by permission", text: "Candidates that point to content this user may not see are removed before anything is returned. Popular, safe prefixes can be cached for everyone." },
        { label: "Rank and return", text: "The remaining suggestions are ordered by relevance and popularity, and the top 8 are returned. When the user presses Enter, the full search runs on the main index with ranking, typo handling and filters." },
      ],
    },
    example: {
      title: "Worked example: the latency budget",
      text: "Suppose a user types at about 5 letters a second and the suggestions must feel instant, say under 100 milliseconds in total. The network may use 40 ms, which leaves around 60 ms for the service. A lookup in a prefix index held in memory takes a few milliseconds; ranking a few dozen candidates adds a few more. A query to the full search index, with scoring across millions of documents, might take 150 ms, which is too slow to run per letter. That is why suggestions get their own small index. Waiting 100 ms after the last keystroke also cuts a ten-letter word from ten requests to perhaps three.",
    },
    tradeoff: {
      title: "Fresh results or fast results",
      gain: {
        label: "A separate, precomputed index gains",
        items: [
          "Suggestions in a few milliseconds from memory",
          "Full search can focus on accuracy without hurting typing speed",
          "Popular prefixes can be cached for everyone",
        ],
      },
      cost: {
        label: "A separate, precomputed index costs",
        items: [
          "New or deleted items appear after a delay",
          "Two indexes must be built and kept in step with the source",
          "Permission rules must be applied to both",
        ],
      },
    },
    pitfalls: [
      "Showing a title in the dropdown that the user is not allowed to open, which still reveals that it exists.",
      "Sending a request on every keystroke with no pause, flooding the service with requests that are immediately out of date.",
      "Measuring only speed, never whether the top suggestions are the ones people actually choose.",
    ],
    remember: [
      "Autocomplete and full search are separate jobs with separate latency budgets.",
      "An index is a delayed copy. Measure and state how late it is.",
      "Filter by permission before returning even a suggestion.",
      "Measure relevance and speed separately.",
    ],
    interview: [
      "Define relevance and latency metrics separately, then explain how you measure how fresh the index is.",
      "Say what the box shows for a query with no results, which interviewers often forget.",
    ],
    quizzes: [
      {
        question: "Why does autocomplete usually use a smaller, separate index from the main search?",
        options: [
          "So that permission checks can be skipped for suggestions",
          "It must answer within milliseconds on every keystroke",
          "To keep a copy of every typed query for ever",
          "The main index cannot be searched using only letters",
        ],
        answer: 1,
        why: "Per-keystroke requests need very low latency, which a small in-memory prefix index provides. A full ranked query is too slow to run for each letter.",
      },
      {
        question: "A private document's title appears in someone's suggestions, though they cannot open it. What is the problem?",
        options: [
          "The index has grown too large to keep in memory",
          "The title contains a spelling mistake in the index",
          "Typo tolerance was switched off for suggestions",
          "The suggestion revealed that a restricted item exists",
        ],
        answer: 3,
        why: "Even a title is information. Permissions must be applied to suggestions as well as to opened results.",
      },
      {
        question: "A new article was published a minute ago but is not found in search yet. What is the most likely reason?",
        options: [
          "The article is too short to be added to the search index in time",
          "The user's query contained a spelling mistake",
          "Search results are cleared automatically every minute",
          "Index lag: the index has not processed the new article yet",
        ],
        answer: 3,
        why: "The index is built from the source data after changes occur, so a recent change can take a little while to appear.",
      },
    ],
  },
  {
    slug: "case-code-deployment",
    title: "Case: A Code Deployment System",
    summary: "Move a verified build to many machines gradually, observably and reversibly.",
    intro: [
      "A deployment system takes a change from a developer's commit and gets it running on production machines. It builds the code, tests it, packages it into a single unit called an artifact, and then rolls that artifact out to servers. Done well, shipping is boring: the same steps, every time, with a quick way back.",
      "The risk is that production is where mistakes cost real users. A bad release that reaches every server at once is an outage. So the design is built around caution: build once and promote the same artifact, release to a small group first, watch real measurements, and only then widen. Build machines also run code that arrived from outside, so they must be isolated from the system that controls releases.",
    ],
    analogy: [
      "Replacing theatre lights bank by bank",
      "The crew changes and tests one bank while the old controls stay ready. If the audience sees flicker, they switch back at once, before every bank has been replaced.",
    ],
    glossary: [
      ["artifact", "The single packaged build, such as a container image, that is tested and then deployed unchanged."],
      ["artifact digest", "A fingerprint calculated from the artifact's contents, proving exactly which build is moving."],
      ["canary", "A small share of production that receives a new version first, so problems show up before they reach everyone."],
      ["health gate", "A measured condition, such as error rate below a limit, that must pass before the rollout continues."],
      ["rollback", "Returning to the previous known-good version."],
    ],
    walkthrough: {
      title: "Follow one commit to production",
      steps: [
        { label: "Build once, in isolation", text: "A developer merges a change. A fresh, isolated worker builds it, runs the tests, and produces one artifact with a digest. The worker has no access to production credentials." },
        { label: "Approve the digest", text: "Checks and policies approve that exact digest. From here on, every environment receives the same artifact. Nothing is rebuilt for production." },
        { label: "Canary", text: "The rollout controller sends the digest to 5% of one region. For ten minutes it compares error rate and response time against the old version." },
        { label: "Promote or roll back", text: "If the gates pass, the share grows in steps to 25%, then 100%. If errors rise at any step, the controller points traffic back at the previous digest and records why." },
      ],
    },
    example: {
      title: "Worked example: a bad release that is caught early",
      text: "A service handles 2,000 requests a second across 40 servers. A new version has a bug that makes 10% of requests fail. If it were released to all 40 at once, about 200 requests a second would fail for everyone. With a canary on 2 servers (5%), only about 5% of traffic reaches the new version, so roughly 10 requests a second fail. The health gate sees an error rate far above the old version's near-zero rate within a couple of minutes, stops the rollout and restores the old digest. Some users were affected, but the impact is 5% of traffic for a few minutes instead of everyone until someone notices.",
    },
    tradeoff: {
      title: "Gradual rollout or release everywhere at once",
      gain: {
        label: "Gradual rollout gains",
        items: [
          "A bad release reaches only a small share of users",
          "Real traffic, not just tests, judges the new version",
          "A quick, rehearsed way back to the last good version",
        ],
      },
      cost: {
        label: "Gradual rollout costs",
        items: [
          "Releases take longer, sometimes hours",
          "Two versions run side by side, so data and APIs must work with both",
          "Health gates need good measurements, or they pass bad releases",
        ],
      },
    },
    lab: "safe-deployment",
    pitfalls: [
      "Running outside build scripts on the same machine that controls production releases.",
      "Rebuilding for each environment, so what reached production is not what was tested.",
      "Treating \"the process started\" as healthy, when it may still be failing real requests.",
    ],
    remember: [
      "Build once. Promote the same artifact everywhere.",
      "Keep untrusted build work apart from the release controller.",
      "Start small, watch real signals, then widen.",
      "Practise rollback. Database changes must work with old and new code.",
    ],
    interview: [
      "Trace a commit to production, then inject a bad canary and show what stops it.",
      "Say what you do when a database change makes rollback hard.",
    ],
    quizzes: [
      {
        question: "Why promote the same artifact through every environment instead of rebuilding for each?",
        options: [
          "Rebuilding is not permitted on testing machines",
          "Artifacts can be produced only once each day",
          "A rebuild makes the pipeline finish faster than testing",
          "What reaches production is exactly what was tested",
        ],
        answer: 3,
        why: "A rebuild can differ subtly from the tested build. Promoting one digest removes that gap.",
      },
      {
        question: "During a canary, the error rate on the new version doubles. What should the rollout controller do?",
        options: [
          "Carry on, since only a small share of users is affected",
          "Stop, restore the previous version and record why",
          "Release to everyone so that more data arrives faster",
          "Wait an hour before looking at the numbers again",
        ],
        answer: 1,
        why: "The gate exists to catch exactly this. Stopping at the small group keeps the harm small.",
      },
      {
        question: "Why should build workers have no access to production credentials?",
        options: [
          "Credentials slow down every build that uses them",
          "Production machines do not need credentials at all",
          "Builds run code from outside, which could misuse that access",
          "Tests cannot run while any secret is present",
        ],
        answer: 2,
        why: "Build scripts can contain anything, including malicious code. Isolating them stops that code reaching production.",
      },
    ],
  },
  {
    slug: "case-retail-brokerage",
    title: "Case: A Retail Brokerage and Order Router",
    summary: "Validate customer orders, route them to a market and keep an auditable state machine.",
    intro: [
      "A retail brokerage lets customers place orders to buy or sell shares. The platform checks the customer's request, makes sure they have enough money or shares, passes the order on to a trading venue, and then tracks what happens: accepted, partly filled, filled, cancelled or rejected. The customer sees a live status and a record afterwards.",
      "Money is involved, so correctness matters more than cleverness. An order must never be placed twice because a button was pressed twice. Its status must only move in valid ways. And because the venue is a separate system that replies in its own time, sometimes out of order, the platform needs its own durable record and a way to compare its books with the venue's. This chapter describes a generic design and says nothing about how any real broker works.",
    ],
    analogy: [
      "A tracked instruction handed to an auction clerk",
      "The clerk checks who signed it and whether funds are available, writes a unique number on it, and notes every acknowledgement that comes back from the auction. Nothing is ever erased, only added to.",
    ],
    glossary: [
      ["idempotency key", "A unique label sent with an order so that submitting it twice creates only one order."],
      ["state machine", "A set of allowed statuses and allowed moves between them, such as routed to filled."],
      ["risk check", "A fixed rule that rejects an order the account must not place, such as one larger than its available funds."],
      ["fill", "A confirmed quantity of an order that has been executed on the venue."],
      ["reconciliation", "Comparing your records with an outside party's and correcting any difference."],
    ],
    walkthrough: {
      title: "Follow one buy order for 100 shares",
      steps: [
        { label: "Accept once", text: "The customer taps Buy. The app sends the order with an idempotency key. The order service stores it as `PENDING_RISK` with a new ID, and a repeated tap with the same key returns the same order instead of making another." },
        { label: "Check the rules", text: "Risk checks confirm the market is open, the customer has enough buying power for 100 shares at the current price, and the product is allowed for this account. A failure moves the order to `REJECTED` with a reason." },
        { label: "Route to the venue", text: "A passing order moves to `ROUTED` and a gateway sends it in the venue's message format. The gateway stores each message it sends and receives." },
        { label: "Record fills", text: "The venue reports fills of 40, then 60 shares. Each fill is appended to the order's history, the status moves to `PARTIALLY_FILLED` and then `FILLED`, and the customer's screen is rebuilt from that history." },
      ],
    },
    example: {
      title: "Worked example: a fill that arrives before the acknowledgement",
      text: "Order `C-104` is routed. Because messages travel separately, the fill for 100 shares reaches the platform before the venue's acknowledgement. A naive design that only allows ROUTED to ACKNOWLEDGED to FILLED rejects the fill as invalid and the customer's holdings are wrong. A better design stores every venue message and decides the status from the whole history, accepting the fill and treating the acknowledgement as late. At the end of the day, reconciliation compares the platform's fills with the venue's report. If the venue shows 100 shares and the platform shows 60, the difference is investigated, not guessed.",
    },
    tradeoff: {
      title: "An append-only history or updating a status in place",
      gain: {
        label: "An append-only history gains",
        items: [
          "A complete audit trail of every message and decision",
          "Late or out-of-order venue messages can still be handled",
          "Screens can be rebuilt, and mistakes diagnosed, from the history",
        ],
      },
      cost: {
        label: "An append-only history costs",
        items: [
          "More storage and more code than a single status column",
          "Current status must be derived or kept in a separate read model",
          "Care is needed to keep that read model in step with the history",
        ],
      },
    },
    lab: "brokerage-order",
    pitfalls: [
      "Showing \"order placed\" before the order is stored, so a crash leaves the customer believing in an order that does not exist.",
      "Assuming one order always produces one immediate fill. Orders can fill in parts, late, or not at all.",
      "Letting a cancel request and a fill race without a rule, so the order can end both cancelled and filled.",
    ],
    remember: [
      "Give every order one durable identity and an idempotency key.",
      "Status changes follow allowed moves, and each is recorded.",
      "Do risk checks before routing, with fixed rules.",
      "Reconcile with the venue, and never rely on messages arriving in order.",
    ],
    interview: [
      "Walk a market order, a partial fill, a cancellation and a late acknowledgement. Do not claim to know any real broker's private design.",
      "Show where idempotency prevents a double order and where the audit log helps.",
    ],
    quizzes: [
      {
        question: "A customer double-taps Buy and the app sends the order twice with the same idempotency key. What should the platform do?",
        options: [
          "Create two separate orders and then cancel one of them afterwards",
          "Reject both and ask the customer to try again later",
          "Ignore the key and decide using the arrival time",
          "Place one order and return it again for the repeat request",
        ],
        answer: 3,
        why: "The key identifies the intent, not the request. A repeat returns the existing order, so the customer buys once.",
      },
      {
        question: "A fill message reaches the platform before the acknowledgement for the same order. What is the best handling?",
        options: [
          "Discard the fill until the acknowledgement arrives",
          "Mark the whole order as failed and refund it",
          "Accept and record the fill, treating the acknowledgement as late",
          "Ask the customer to submit the order again",
        ],
        answer: 2,
        why: "Venue messages can be out of order, and a fill is real whatever order it arrives in. Storing every message lets the status be decided from the whole history.",
      },
      {
        question: "What does end-of-day reconciliation do?",
        options: [
          "Deletes every order that was never filled during the trading day",
          "Resets every customer's balance to zero overnight",
          "Replaces the audit log with a short summary",
          "Compares its records with the venue's and investigates gaps",
        ],
        answer: 3,
        why: "Two independent records should agree. Where they do not, someone must find out why instead of assuming either one is right.",
      },
    ],
  },
  {
    slug: "case-community-discussion-api",
    title: "Case: A Community Discussion API",
    summary: "Serve posts, votes and comment trees while resisting abuse and unstable pagination.",
    intro: [
      "A community discussion service lets people post in topic communities, reply in threaded comments and vote things up or down. The API serves lists of posts, a single post with its comments, and actions such as posting, voting and reporting. Moderators can hide or remove content.",
      "Two things get expensive. A popular post can attract thousands of votes and replies a minute, and a naive design recalculates scores and nested trees on every page view. And the lists keep changing while people scroll them, so page numbers produce repeats and gaps. The design keeps the real actions simple and safe, and builds ranked views from them.",
    ],
    analogy: [
      "A moderated town noticeboard",
      "People pin notices and write replies, and moderators take down anything abusive. A popular board needs a reading order that stays steady even while new notes keep arriving.",
    ],
    glossary: [
      ["cursor pagination", "Fetching the next page by saying where the last one ended, rather than by page number."],
      ["derived score", "A ranking value calculated from votes and time, which can be rebuilt at any time."],
      ["unique constraint", "A database rule that allows only one row with a given combination of values."],
      ["moderation state", "Whether an item is visible, hidden or removed, kept apart from its original text."],
      ["hot post", "One item receiving far more reads or writes than the average."],
    ],
    walkthrough: {
      title: "Follow one vote and one page of the front list",
      steps: [
        { label: "Authorise and write", text: "A signed-in member upvotes a post. The service checks they may see the community, then writes a vote row. A unique rule on member and post means a second tap cannot count twice; it changes or removes the vote instead." },
        { label: "Emit an event", text: "The committed vote produces an event. A background worker updates the post's derived ranking score, so the vote request itself stays quick." },
        { label: "Read a ranked page", text: "Another reader asks for the community's top posts. The service reads the next 20 posts by score from a prepared index, skipping hidden ones, rather than calculating scores on the spot." },
        { label: "Return a cursor", text: "The reply includes a cursor made of the last post's score and ID. The next request asks for items after that pair, so a post that rises in score meanwhile does not push earlier posts onto the next page again." },
      ],
    },
    example: {
      title: "Worked example: why pages must not use offsets",
      text: "A reader opens page 1 of the top posts, 20 at a time, and spends a minute reading. Meanwhile 3 new posts jump into the top 20. With offsets, page 2 means \"skip 20, take 20\", so the 3 posts that were pushed from page 1 reappear at the top of page 2 as repeats. If posts had been removed instead, three posts would be skipped. With a cursor holding the last seen score and ID, page 2 means \"items ranked after this one\", and the result stays correct whatever happens above it. The ID breaks ties between posts with equal scores, so ordering is always unambiguous.",
    },
    tradeoff: {
      title: "Live scores or derived scores",
      gain: {
        label: "Derived scores gain",
        items: [
          "Votes are quick to accept, and popularity work cannot slow them",
          "Rankings can be rebuilt if the formula changes",
          "Reads come from a prepared, sorted view",
        ],
      },
      cost: {
        label: "Derived scores cost",
        items: [
          "The ranking is a few seconds behind the latest vote",
          "A second, derived data set to maintain",
          "Hidden or removed items must be filtered at read time too",
        ],
      },
    },
    pitfalls: [
      "Building the whole nested comment tree and every score on each page view.",
      "Counting votes by adding a number with no rule on who voted, so repeats and bots inflate scores.",
      "Deleting reported text immediately and losing the evidence moderators need to review it.",
    ],
    remember: [
      "Keep the real actions small. Derive ranking from them.",
      "Use a unique rule so one member counts once.",
      "Page changing lists with cursors that include a tie-breaker.",
      "Store moderation state apart from the text.",
    ],
    interview: [
      "Design create-post, vote and read-thread endpoints, then explain abuse controls and stable pagination.",
      "Mention what you do for one hugely popular thread.",
    ],
    quizzes: [
      {
        question: "A member taps the upvote button three times quickly. What makes only one vote count?",
        options: [
          "A faster server that handles taps more quickly",
          "A unique rule on member and post in the database",
          "Asking the member to confirm every tap they make",
          "Recalculating every score once a day instead",
        ],
        answer: 1,
        why: "A database rule on the pair allows one row per member per post, however many requests arrive.",
      },
      {
        question: "Why is a cursor made from score alone, with no ID, risky?",
        options: [
          "Scores are too large to be stored inside a cursor that is sent to clients",
          "A cursor must always contain a calendar date",
          "Several posts can share a score, so the next page is ambiguous",
          "Post IDs are not allowed to appear in addresses",
        ],
        answer: 2,
        why: "Equal scores need a tie-breaker. With the ID added, every post has a unique, stable position.",
      },
      {
        question: "A moderator hides a post. Why keep its text rather than deleting it?",
        options: [
          "So that it can still be shown to every member of the community",
          "Because hidden text takes up no storage space",
          "So the decision can be reviewed, appealed or reversed",
          "To keep its old score high in the rankings",
        ],
        answer: 2,
        why: "Separating visibility from the content lets moderators review and reverse decisions, and keeps evidence for abuse reports.",
      },
    ],
  },
  {
    slug: "case-video-streaming",
    title: "Case: On-Demand Video Streaming",
    summary: "Transcode one upload into adaptive segments and serve viewers through nearby caches.",
    intro: [
      "A video streaming service accepts an uploaded video and lets thousands of people watch it, on phones and televisions, over fast and slow connections. It has two separate paths: upload and processing, which happens once per video, and playback, which happens millions of times.",
      "The upload is converted into several sizes, each cut into short pieces a few seconds long, with a small file listing them all. A player downloads a piece at a time and picks the size that suits the connection right now, switching as it changes. Because video is heavy, the pieces are served from caches close to viewers instead of from the main servers. The design principle is to do the expensive work once, ahead of time, and make delivery a simple copy of ready-made files.",
    ],
    analogy: [
      "A book offered in short chapters and several print sizes",
      "A reader downloads the next short chapter in the size their connection can handle, rather than waiting for one enormous book. A table of contents lists every chapter and size.",
    ],
    glossary: [
      ["transcoding", "Converting a video into another size or quality, usually in several versions."],
      ["segment", "A short piece of video, often a few seconds long, that can be downloaded on its own."],
      ["manifest", "A small file listing the available qualities and where each segment can be fetched."],
      ["adaptive bitrate", "The player's ability to switch between qualities as the network speeds up or slows down."],
      ["CDN", "A network of caches placed near viewers that serve popular files without reaching the original server."],
    ],
    walkthrough: {
      title: "Follow one upload to the first frame",
      steps: [
        { label: "Upload and scan", text: "A creator uploads a ten-minute video directly to object storage. A scan checks it is a real video file, and a job is placed on a queue instead of making the creator wait." },
        { label: "Transcode", text: "Workers create 360p, 720p and 1080p versions, each cut into 4-second segments. Workers can run on different segments at the same time, and a failed segment is simply retried." },
        { label: "Publish together", text: "Only when every segment of every required quality exists does the system write the manifest and mark the video ready. A viewer is never given a manifest that points at missing pieces." },
        { label: "Play and adapt", text: "A viewer's player fetches the manifest and starts with a low quality for a fast start. It measures download speed, moves up to 720p, and drops back to 360p if the connection weakens. Segments come from a nearby CDN cache when they are popular." },
      ],
    },
    example: {
      title: "Worked example: the cost of sending video the wrong way",
      text: "Suppose 100,000 people watch at once at an average of 3 megabits per second. That is 300 gigabits per second, far beyond what a handful of application servers can send. Sending video through those servers would be both costly and slow. A CDN spreads the load across many edge locations, and since every viewer asks for the same files, most requests are answered from a cache after the first. Suppose 95% hit the cache: the origin then serves only 5%, about 15 gigabits per second. Segments are never edited after creation, so caching them is safe, and a new version of a video simply gets new segment names.",
    },
    tradeoff: {
      title: "Many qualities or one",
      gain: {
        label: "Many qualities gain",
        items: [
          "Viewers on slow connections can still watch without stopping",
          "Playback starts quickly at low quality and improves",
          "Each device gets a size that suits its screen",
        ],
      },
      cost: {
        label: "Many qualities cost",
        items: [
          "Storage and processing multiply with each quality",
          "Publishing must wait for every required version to be ready",
          "More files for the CDN to cache and manage",
        ],
      },
    },
    lab: "video-streaming",
    pitfalls: [
      "Sending every playback byte through application servers instead of a CDN.",
      "Publishing the manifest before all the segments it lists are ready, so playback stalls partway through.",
      "Transcoding during the upload request, making the creator wait for slow work.",
    ],
    remember: [
      "Do the heavy work once, in the background, and deliver ready-made files.",
      "Short segments let the player switch quality.",
      "Publish the manifest only when everything it names exists.",
      "Never edit a segment in place. Give a new version new names.",
    ],
    interview: [
      "Separate the upload path from the playback path, then estimate outgoing bandwidth.",
      "Explain how the player picks a quality and what happens when the network changes.",
    ],
    quizzes: [
      {
        question: "A viewer's connection suddenly slows down mid-video. How does adaptive streaming cope?",
        options: [
          "The video pauses and waits until the connection has fully recovered",
          "The server restarts the whole video at lower quality",
          "The viewer has to refresh the page to continue",
          "The player requests the next segments at a lower quality",
        ],
        answer: 3,
        why: "Because the video is available in several qualities as short segments, the player can switch for the very next piece.",
      },
      {
        question: "Why is the manifest published only after all segments exist?",
        options: [
          "Manifests cannot be edited once they are published",
          "Segments are generated from the manifest on demand",
          "CDNs refuse to cache any manifest that looks incomplete to them",
          "A viewer could be sent to pieces that do not exist yet",
        ],
        answer: 3,
        why: "The manifest is the viewer's map. If it names missing segments, the player hits holes.",
      },
      {
        question: "Why is a CDN a good fit for video segments?",
        options: [
          "It transcodes the video again while it is being played",
          "It removes the need to keep videos in object storage",
          "Segments never change, so nearby copies can serve most requests",
          "It forces every video to play at the highest quality",
        ],
        answer: 2,
        why: "Fixed files can be cached widely without going stale, which keeps heavy traffic off the origin.",
      },
    ],
  },
  {
    slug: "case-ride-dispatch",
    title: "Case: Ride Dispatch and Geospatial Matching",
    summary: "Find fresh nearby candidates quickly, then commit exactly one driver to a trip.",
    intro: [
      "A ride-dispatch service matches a rider who needs a trip with a driver who is nearby and free. Drivers' phones report their location every few seconds. When a rider asks for a trip, the service finds drivers close to the pickup point, sends them offers, and assigns the first one who accepts.",
      "The work divides into two very different parts. Finding nearby drivers is a fast, approximate search over data that is always a few seconds old. Choosing the winner must be exact: one trip, one driver, with no double assignment. The design uses a loose, quick search to build a short list, then a single strict step to decide, and it deals honestly with the fact that a driver's last known position may be wrong.",
    ],
    analogy: [
      "Calling nearby taxis, then closing the assignment book",
      "Several taxis may hear the call, but the dispatcher writes down only the first valid acceptance in the book and tells all the others that the job is gone.",
    ],
    glossary: [
      ["geospatial cell", "A small map area with an identifier, so that finding nearby things means looking up a few cells."],
      ["stale location", "A position report that is old enough that the driver may have moved far from it."],
      ["candidate", "A driver who might be a good match but still needs to be checked and asked."],
      ["offer", "A short-lived request sent to a driver, which expires if they do not answer."],
      ["conditional update", "A write that only succeeds if the record is still in the state you expect."],
    ],
    walkthrough: {
      title: "Follow one ride request",
      steps: [
        { label: "Keep locations fresh", text: "Each driver's app sends its position every 4 seconds. The service overwrites that driver's single latest position in the cell they are in. Old positions are not kept for matching." },
        { label: "Search nearby cells", text: "A rider requests a trip. The service looks up the rider's cell and the cells around it, drops drivers whose last report is too old or who are busy, and widens the search if too few remain." },
        { label: "Rank and offer", text: "It ranks a short list of about five by estimated pickup time and sends each a short-lived offer. Ranking uses a bounded list, so nothing is locked while it works." },
        { label: "Assign once", text: "Drivers A and B both accept. The trip service runs a conditional update from `SEARCHING` to `ASSIGNED(A)`. It succeeds for A, fails for B, and B is told the trip is no longer available." },
      ],
    },
    example: {
      title: "Worked example: how big should a cell be?",
      text: "Suppose a city has 50,000 drivers, each reporting every 4 seconds. That is 12,500 location writes a second, which suits overwriting one small record per driver. If cells are about 1 km across and the city is 400 km², there are roughly 400 cells, an average of about 125 drivers per cell. A rider's search covers their cell and its eight neighbours, so around 1,100 drivers are checked and filtered down to five. In a sparse suburb a cell may hold two drivers, so the search widens outward. In a packed centre a cell may hold thousands, so cells can be subdivided. The size is a tuning decision, balancing how many cells you read against how many drivers you filter.",
    },
    tradeoff: {
      title: "Quick approximate search, strict final decision",
      gain: {
        label: "Splitting search from assignment gains",
        items: [
          "The search is fast and can tolerate slightly old data",
          "Only one small step needs strong guarantees",
          "No driver or rider is locked while ranking runs",
        ],
      },
      cost: {
        label: "Splitting search from assignment costs",
        items: [
          "Some offers go to drivers who have just become busy",
          "Late acceptances must be rejected politely",
          "Stale positions can make a driver look nearer than they are",
        ],
      },
    },
    lab: "ride-dispatch",
    pitfalls: [
      "Treating the nearest cached coordinate as a guaranteed available driver.",
      "Locking many candidate drivers while ranking, so other requests wait on them.",
      "Keeping drivers' location history longer than needed for matching, which is a privacy cost with no benefit.",
    ],
    remember: [
      "Search is approximate. Assignment is exact.",
      "Overwrite one latest position per driver and treat old ones as unreliable.",
      "Decide the winner with one conditional state change.",
      "Handle the dense centre and the sparse edge differently.",
    ],
    interview: [
      "Trace location updates, an expanding-radius search and two drivers accepting at nearly the same moment.",
      "Say how long a location can be before you ignore it, and why.",
    ],
    quizzes: [
      {
        question: "Two drivers accept the same trip within a millisecond. What ensures only one is assigned?",
        options: [
          "The driver whose phone has the faster mobile data connection always wins",
          "The trip is sent to both drivers and they share it",
          "The system waits for the rider to choose between them",
          "A conditional update that succeeds only while the trip is searching",
        ],
        answer: 3,
        why: "The update changes the trip's state from SEARCHING only once. The second attempt finds a different state and is rejected.",
      },
      {
        question: "A driver's last position is 90 seconds old. What should dispatch do with that driver?",
        options: [
          "Treat them as not reliably nearby and skip them",
          "Offer the trip anyway, because they were close once",
          "Delete the driver's account from the system",
          "Ask the rider to guess where the driver is",
        ],
        answer: 0,
        why: "A driver can travel a long way in 90 seconds, so the position says little about where they are.",
      },
      {
        question: "Why store only the latest position per driver for matching?",
        options: [
          "Old positions are illegal to keep for any purpose",
          "Phones are not able to send a history of positions",
          "Matching needs where drivers are now, so overwriting is cheap",
          "It makes the map cells smaller and so quicker to read",
        ],
        answer: 2,
        why: "Matching only uses current positions. A single overwritten record per driver is cheap to update and to read.",
      },
    ],
  },
  {
    slug: "case-accommodation-booking",
    title: "Case: Accommodation Search and Booking",
    summary: "Search flexible inventory quickly while keeping reservation and price confirmation correct.",
    intro: [
      "An accommodation booking site lets a traveller search for places to stay in a city on certain dates for a number of guests, compare prices, and book one. Each property has rooms, each room is sold night by night, and prices change with demand and season.",
      "The search side wants speed and flexibility: filter by area, price and facilities across thousands of properties. The booking side wants certainty: a room-night can be sold once, at a price the guest agreed to. So search runs on a fast copy that may be slightly out of date, and booking re-checks everything against the real records. Treating a search result as a promise is the mistake the design exists to prevent.",
    ],
    analogy: [
      "A travel agent's catalogue and reservation ledger",
      "The catalogue lets you compare rooms quickly, but only the ledger can say whether a room is still free on your dates at the price quoted.",
    ],
    glossary: [
      ["property-night", "One unit of sellable stock: one room at one property for one night."],
      ["search index", "A fast copy of listings built for filtering and ranking, which can be slightly behind the real data."],
      ["quote", "A price for specific dates that is only valid until a stated expiry time."],
      ["reservation state machine", "The allowed statuses of a booking, such as pending, confirmed, cancelled or expired, and the allowed moves between them."],
      ["idempotent command", "A request that can be repeated without repeating its effect, because a key identifies it."],
    ],
    walkthrough: {
      title: "Follow one three-night booking",
      steps: [
        { label: "Search on the index", text: "A traveller searches a city for 3 nights, 2 guests, under a price limit. The search index returns 40 candidate rooms with approximate prices and availability." },
        { label: "Quote", text: "They pick one. The pricing service calculates the exact total for those nights, including taxes, and gives a quote that expires in 10 minutes." },
        { label: "Claim every night at once", text: "On checkout the booking service sends one request with an idempotency key. In a single transaction it tries to claim all three property-night rows. If any night is already sold, the whole claim fails and nothing is held." },
        { label: "Pay and confirm", text: "With the nights held, the traveller pays. A payment callback moves the reservation from `PENDING` to `CONFIRMED`. If payment is never completed, the hold expires and the nights return to stock." },
      ],
    },
    example: {
      title: "Worked example: why all nights are claimed together",
      text: "A guest wants nights 10, 11 and 12. Another guest has already booked night 11. If the system claimed nights one at a time, it would hold nights 10 and 12 and then fail on 11, leaving two nights stuck and unsold until someone cleaned up. Claiming all three in one transaction means the claim either takes all three or none. The search index might have shown the room as free for the whole stay because it was updated a few seconds earlier. The final check against the real record catches this, and the guest sees a clear message with similar rooms instead of a confirmation that cannot be honoured.",
    },
    tradeoff: {
      title: "Search speed against booking certainty",
      gain: {
        label: "Separating search from booking gains",
        items: [
          "Search is fast and handles heavy browsing traffic",
          "Filters and ranking can change without touching the booking records",
          "Bookings are decided by one strict source",
        ],
      },
      cost: {
        label: "Separating search from booking costs",
        items: [
          "Some search results are no longer available at checkout",
          "The index must be kept up to date from the real records",
          "Price shown in search may differ from the final quote",
        ],
      },
    },
    pitfalls: [
      "Promising availability or price from a search result without checking it again at booking.",
      "Claiming nights one by one, so a failed stay leaves some nights stuck.",
      "Ignoring time zones, so the same night is counted on different dates in different places.",
    ],
    remember: [
      "Search results are candidates. Booking re-checks price and stock.",
      "Claim all nights in one transaction.",
      "Quotes expire. Say when.",
      "Make booking and payment steps safe to repeat.",
    ],
    interview: [
      "Model room-night stock and walk two guests booking overlapping dates.",
      "Explain what the guest sees when the search was out of date.",
    ],
    quizzes: [
      {
        question: "Search showed a room free for three nights, but checkout fails because one night was just sold. Which part behaved correctly?",
        options: [
          "Neither, because search results should never be even slightly out of date",
          "Search, because it ought to lock every room it displays",
          "The quote, because a quote decides what stock exists",
          "The final check against the real stock, which refused the sale",
        ],
        answer: 3,
        why: "Search is a quick copy that may lag, so the final check against the real records is the one that must be right.",
      },
      {
        question: "Why claim all three nights in one transaction?",
        options: [
          "It makes the price quote expire sooner than planned",
          "Either every night is taken or none is, leaving no stray holds",
          "Nights cannot be stored as separate rows in a database",
          "It lets the guest skip the payment step entirely",
        ],
        answer: 1,
        why: "A partial claim leaves nights stuck. A transaction makes the claim all-or-nothing.",
      },
      {
        question: "A booking request is sent twice because the connection dropped. What prevents two reservations?",
        options: [
          "A longer expiry time on the price quote",
          "A larger and faster search index for all of the property listings",
          "An idempotency key that marks the second request as a repeat",
          "A bigger list of rooms returned by the search",
        ],
        answer: 2,
        why: "The key tells the service the second request is the same intent as the first, so it returns the original reservation.",
      },
    ],
  },
  {
    slug: "case-web-crawler",
    title: "Case: A Polite Web Crawler",
    summary: "Discover pages at scale while respecting host limits, duplicate content and retry boundaries.",
    intro: [
      "A web crawler starts from a list of addresses, downloads each page, finds the links inside it, and adds those links to the list of pages still to visit. Search engines and dataset builders use crawlers to discover and refresh pages across many websites.",
      "The idea is simple, but a crawler touches other people's servers, so it must be polite and careful. Hitting one small site with a thousand requests a second can knock it over. The web also contains traps: calendars with endless next-month links, the same page under many addresses, and enormous files. The design is mostly about fairness between sites, remembering what has been seen, and putting a limit on everything.",
    ],
    analogy: [
      "Researchers sharing a visiting schedule",
      "They keep one shared list of places to visit, never send a crowd to the same office at once, and note which documents they have already copied so nobody copies them twice.",
    ],
    glossary: [
      ["URL frontier", "The stored list of discovered addresses that are waiting to be fetched."],
      ["politeness", "Limits such as a minimum delay between requests to one site, so the crawler does not overload it."],
      ["robots.txt", "A file on a website that states which parts crawlers are asked not to visit."],
      ["canonicalisation", "Turning different spellings of the same address into one standard form."],
      ["content fingerprint", "A short value calculated from a page's text, used to spot duplicate pages."],
    ],
    walkthrough: {
      title: "Follow one discovered address",
      steps: [
        { label: "Normalise and enqueue", text: "A link `HTTP://Example.com/a/../b?utm=1` is found. The crawler rewrites it into one standard form, drops tracking parameters, and checks it has not been seen. If it is new, it joins that site's queue in the frontier." },
        { label: "Wait for its turn", text: "Queues are split by website. A scheduler releases at most one address per site every few seconds, and checks the site's `robots.txt` first. Other sites' queues carry on in the meantime." },
        { label: "Fetch within limits", text: "A fetcher downloads the page with a timeout and a size cap, so a huge file or a slow server cannot tie it up. Failures go back to the queue a limited number of times." },
        { label: "Parse and deduplicate", text: "The parser extracts text and links. The text's fingerprint is compared with those already stored, and a match marks the page a duplicate. New links go through the first step, and the page is later recrawled according to how often it changes." },
      ],
    },
    example: {
      title: "Worked example: a crawl trap and a polite delay",
      text: "A site has a calendar page with a link to \"next month\", forever. A crawler with one big first-in-first-out queue will follow it for months, filling the queue with useless addresses and starving every other site. A per-site queue with a limit on depth, and a cap on addresses per site, stops this. Politeness also sets the speed. With a delay of 2 seconds per site, one site is fetched at 0.5 pages per second. To fetch 1,000 pages a second overall, the crawler must be working on at least 2,000 sites at once. The crawl is fast because it is wide, never because it hammers one site.",
    },
    tradeoff: {
      title: "Crawling quickly or crawling politely",
      gain: {
        label: "Polite scheduling gains",
        items: [
          "Sites are not overloaded, so they do not block the crawler",
          "Fair use of time across many different sites",
          "Fewer failures from servers pushed beyond their limits",
        ],
      },
      cost: {
        label: "Polite scheduling costs",
        items: [
          "A large site takes much longer to crawl fully",
          "More complex queues and scheduling",
          "Fresh changes on slow-crawled sites are seen later",
        ],
      },
    },
    pitfalls: [
      "One global queue that floods a small site and lets endless calendar links use every worker.",
      "Treating each spelling of an address as a different page, so duplicates fill the frontier.",
      "No limit on page size or redirects, so one bad response can stall a worker.",
    ],
    remember: [
      "Queue per site, and release addresses at a polite pace.",
      "Normalise addresses and fingerprint content to avoid duplicates.",
      "Cap everything: size, depth, redirects and retries.",
      "Respect the rules a site publishes.",
    ],
    interview: [
      "Trace a discovered address through normalisation, scheduling, fetching, parsing and duplicate detection.",
      "Say how you avoid crawl traps and decide when to revisit a page.",
    ],
    quizzes: [
      {
        question: "A crawler uses one queue for every address and one site has a million of them. What goes wrong?",
        options: [
          "The crawler finishes sooner because a single queue is simpler to run",
          "That site is hit again and again while others wait behind it",
          "Every site is crawled equally often as a result",
          "Robots.txt files stop being read by the fetchers",
        ],
        answer: 1,
        why: "A shared first-in-first-out queue sends the big site's addresses one after another, overloading it and starving the others.",
      },
      {
        question: "Two different addresses return identical text. How does the crawler avoid storing both?",
        options: [
          "It stores both and deletes one of them next year",
          "It asks the website which of the two is the real one",
          "It compares content fingerprints and keeps only one copy",
          "It stops crawling that entire website for good",
        ],
        answer: 2,
        why: "Identical text gives an identical fingerprint, which identifies the duplicate cheaply.",
      },
      {
        question: "Why does a crawler set a maximum page size and timeout?",
        options: [
          "It makes the fetched pages easier for people to read",
          "Because robots.txt requires every crawler to set them",
          "It increases the number of duplicate pages found",
          "One huge or slow response cannot tie up a worker",
        ],
        answer: 3,
        why: "Without bounds, a single bad server can hold a worker indefinitely and slow the whole crawl.",
      },
    ],
  },
  {
    slug: "case-paste-and-text-sharing",
    title: "Case: A Paste and Text-Sharing Service",
    summary: "Store immutable text under short keys with expiry, privacy and abuse controls.",
    intro: [
      "A paste service lets someone drop a block of text, such as code or a log, and get a short link to share. Anyone with the link can read it, and some pastes are set to expire after an hour or a week, or to be private.",
      "It looks like a small version of the link shortener, but the content is yours to hold, so new questions appear. Text can be large, so size limits matter. Expired text must stop being served even if the clean-up job has not run yet. And a private paste is only private if its key cannot be guessed. The design stays simple by never editing a paste: once created, the text is fixed.",
    ],
    analogy: [
      "A numbered note in a secure locker",
      "The note gets a pickup number and an expiry date. For a public note, knowing the number is enough; for a private one, the number must be so hard to guess that only the person you tell can find it.",
    ],
    glossary: [
      ["immutable", "Created once and never changed afterwards."],
      ["high entropy", "Having enough randomness that nobody could guess the value by trying."],
      ["capability link", "A web address that is itself the permission, because it is too random to guess."],
      ["logical expiry", "Refusing to serve a paste after its deadline, even if its data has not yet been deleted."],
      ["burn after read", "A setting that makes a paste disappear after the first successful view."],
    ],
    walkthrough: {
      title: "Follow one private, expiring paste",
      steps: [
        { label: "Validate", text: "A user pastes 40 KB of log text, picks a 24-hour expiry and marks it private. The service checks the size limit and rejects anything over it." },
        { label: "Create the key", text: "It generates a 128-bit random key, which is far too large to guess, and stores the compressed text with an `expires_at` time and the privacy setting. The text is never edited afterwards." },
        { label: "Share", text: "The user gets a link containing the key and sends it to a colleague. A public paste would also work this way, but could be listed or searched." },
        { label: "Read and expire", text: "On a read, the service checks `expires_at` before returning anything, even when the content is cached. After 24 hours it answers not-found, and a background job deletes the data later." },
      ],
    },
    example: {
      title: "Worked example: guessable keys against random keys",
      text: "If keys are sequential numbers, an attacker can try 1, 2, 3 and read every private paste in a few minutes. If keys are random 128-bit values, there are about 3.4 x 10^38 possibilities. Even if an attacker tried a billion guesses a second, they would not exhaust those in any lifetime, and the chance of hitting a real key is negligible. Storage is a simple sum too: 10 million pastes a month at an average of 5 KB is about 50 GB, or around 20 GB compressed, which is manageable. Only reads of popular pastes need a cache; most pastes are read once or twice.",
    },
    tradeoff: {
      title: "Long random keys against short friendly ones",
      gain: {
        label: "Long random keys gain",
        items: [
          "Private pastes cannot be found by guessing",
          "No pattern that reveals how many pastes exist",
          "Keys can be made without a shared counter",
        ],
      },
      cost: {
        label: "Long random keys cost",
        items: [
          "Links are long and hard to type or read aloud",
          "Anyone who obtains the link can read the paste",
          "A shorter key is only acceptable for public content",
        ],
      },
    },
    pitfalls: [
      "Using sequential IDs for private content, which lets anyone walk through all of it.",
      "Relying only on a background job to enforce expiry, so expired data can still be read until the job runs.",
      "Having no size limit or abuse checks, so the service becomes free file hosting for harmful content.",
    ],
    remember: [
      "Pastes are immutable. Delete and create instead of editing.",
      "Private means unguessable or authenticated, not merely hidden.",
      "Check expiry on every read.",
      "Limit size and scan for abuse.",
    ],
    interview: [
      "Estimate key space and storage, then design the public, private and expiring read paths.",
      "Explain how burn-after-read stays correct when two people open the link together.",
    ],
    quizzes: [
      {
        question: "A paste expired an hour ago, but the cleanup job has not yet run. What should a read do?",
        options: [
          "Serve it, because the data has not yet been deleted by the cleanup job",
          "Serve it only to the person who created the paste",
          "Extend its expiry by another hour automatically",
          "Refuse it, because the read path checks the expiry time",
        ],
        answer: 3,
        why: "Expiry is a rule enforced when reading. Cleanup only saves space and can run later.",
      },
      {
        question: "Why are sequential numbers a poor choice for private paste keys?",
        options: [
          "Numbers cannot be saved in a database as keys",
          "Anyone could try neighbouring numbers and read other pastes",
          "Numeric keys are slower for a browser to read",
          "Short numbers need more memory than random strings",
        ],
        answer: 1,
        why: "Private means unguessable. A counter is the easiest thing in the world to guess.",
      },
      {
        question: "Two people open a burn-after-read link at the same moment. What must the service ensure?",
        options: [
          "Both reads succeed and the paste is only deleted a moment afterwards",
          "Neither read succeeds, so the paste stays unread",
          "The second reader is handed a copy from the cache",
          "Only one read succeeds, through an atomic conditional delete",
        ],
        answer: 3,
        why: "An atomic check lets one request claim the paste. Without it, both can read before the deletion.",
      },
    ],
  },
  {
    slug: "case-photo-media-pipeline",
    title: "Case: A Photo and Media Pipeline",
    summary: "Accept large uploads safely, derive multiple formats and publish them atomically through a CDN.",
    intro: [
      "A photo pipeline accepts pictures from users and prepares them for display: a tiny thumbnail for lists, a medium size for the page and a large one for full screen. It checks that the upload is safe, removes sensitive details if needed, and serves each size quickly to people around the world.",
      "The point of the design is that the user should not wait for any of it. The original goes straight to storage, the processing happens in the background, and the photo only appears once every needed size is ready. Because background jobs can fail and be repeated, each step has to be safe to run twice. Because uploads come from strangers, nothing is shown before it has been checked.",
    ],
    analogy: [
      "A photo lab that keeps the negative",
      "The lab protects the original negative, makes the different print sizes, and only hands over the finished set after every print has passed inspection.",
    ],
    glossary: [
      ["signed upload URL", "A short-lived address that lets a client upload one object directly to storage."],
      ["derivative", "A resized or reformatted copy made from the original."],
      ["idempotent worker", "A worker that can process the same job more than once with the same result."],
      ["versioned manifest", "A small record listing every file in one complete, published set."],
      ["decompression bomb", "A tiny file that expands into a huge image, designed to exhaust a server's memory."],
    ],
    walkthrough: {
      title: "Follow one photo upload",
      steps: [
        { label: "Upload directly", text: "The app asks the API for a signed upload URL, then sends the 6 MB original straight to object storage. The API creates a record in `PROCESSING` state and never carries the file bytes itself." },
        { label: "Scan and inspect", text: "The storage event starts a worker. It checks the real file type, refuses absurd dimensions, removes location data from the metadata and scans for harmful content." },
        { label: "Make the variants", text: "Workers write thumbnail, medium and large versions under names like `photo/42/v1/medium`. Because the names are fixed, running a job twice just overwrites the same file." },
        { label: "Publish and serve", text: "When every required variant exists, one transaction marks the photo `READY` and exposes the manifest. The CDN then serves the right size, and a private photo uses short-lived signed links." },
      ],
    },
    example: {
      title: "Worked example: a duplicate event and a half-finished set",
      text: "Storage notifications are delivered at least once, so the same upload event may arrive twice. If workers added a new random file name each time, the second run would create a second set of images and waste storage. Using the deterministic name `photo/42/v1/medium` means the second run overwrites the first with the same content. Suppose the thumbnail and medium sizes finish but the large one crashes. The photo stays `PROCESSING` and invisible. A retry fills in the large size, then the status flips. A viewer therefore never receives a page where one size is missing. If the user deletes the photo, a deletion job removes every variant and the CDN copies are purged.",
    },
    tradeoff: {
      title: "Processing in the background or during the upload",
      gain: {
        label: "Background processing gains",
        items: [
          "The user's upload finishes as fast as the network allows",
          "Heavy work scales with a queue of workers",
          "Failures can be retried without involving the user",
        ],
      },
      cost: {
        label: "Background processing costs",
        items: [
          "The photo is not visible straight away",
          "Status tracking and retries add code",
          "Workers must handle duplicate and out-of-order events",
        ],
      },
    },
    pitfalls: [
      "Making the user wait while every resize completes, or serving the original before scanning is done.",
      "Using random output names so retries create duplicates.",
      "Publishing as soon as the first variant is ready, so pages show a broken image.",
    ],
    remember: [
      "Upload directly to storage with a short-lived permission.",
      "Keep the original untouched. Make copies from it.",
      "Name outputs predictably so retries are safe.",
      "Publish the set only when it is complete and checked.",
    ],
    interview: [
      "Trace upload, retryable processing, atomic publishing, private delivery and deletion.",
      "Name two ways an upload could be abused and how the pipeline defends against each.",
    ],
    quizzes: [
      {
        question: "Why should the API give the client a signed upload URL instead of receiving the photo itself?",
        options: [
          "Signed addresses automatically make photos smaller",
          "The API servers are unable to read image files",
          "Large files go straight to storage, not through API servers",
          "It removes the need for any permission checks at all",
        ],
        answer: 2,
        why: "Large uploads would otherwise pass through application servers, using their time and memory. A signed URL limits the permission to one object for a short time.",
      },
      {
        question: "A processing job runs twice for the same upload. How do predictable output names help?",
        options: [
          "They prevent the job from ever being run a second time by the queue",
          "They make the generated image files much smaller",
          "They delete the original photo once the job ends",
          "The second run rewrites the same files, creating no duplicates",
        ],
        answer: 3,
        why: "Writing the same name with the same content is harmless, which makes repeats safe.",
      },
      {
        question: "The thumbnail is ready, but the large size failed. What should the user see?",
        options: [
          "The photo shown with a broken large version on the page for everyone",
          "The original upload, shown before it has been scanned",
          "An empty page with no explanation for the user",
          "The photo stays unpublished until every required size exists",
        ],
        answer: 3,
        why: "Publishing happens only for a complete set, so no viewer meets a missing size.",
      },
    ],
  },
  {
    slug: "case-online-learning-platform",
    title: "Case: An Online Learning Platform",
    summary: "Serve a searchable course catalogue, reliable lessons, resumable progress and fair quizzes.",
    intro: [
      "An online learning platform has two kinds of data that behave very differently. The course catalogue and lesson videos are the same for everyone, so they can be copied and cached widely. A learner's enrolment, progress and quiz attempts belong to one person, change often and must be correct.",
      "A good design keeps these apart. The shared content goes through search indexes and a CDN, and can be a little out of date. The personal records live in a store that is exact and checks who is asking. Two details need special care: progress is reported in small bursts from phones that go offline and retry, and quizzes can be edited by authors after learners have already taken them, so every attempt must remember which version of the questions it answered.",
    ],
    analogy: [
      "A school library joined to a marked workbook",
      "The library helps a learner find the right lesson and is the same for everyone. The workbook belongs to one learner and remembers the exact page, the answers and the teacher's rules for what counts as complete.",
    ],
    glossary: [
      ["catalogue read model", "A search-friendly copy of published course details, built from the real records."],
      ["enrolment", "The authoritative record that one learner may access one course."],
      ["progress event", "A small, retry-safe record of something a learner did, such as reaching a point in a video."],
      ["question-set version", "The exact version of a quiz that a learner's attempt was marked against."],
      ["media manifest", "A file listing the video qualities and segments for a lesson, used for adaptive playback."],
    ],
    walkthrough: {
      title: "Follow one learner through a lesson and a quiz",
      steps: [
        { label: "Find and enrol", text: "The learner searches the catalogue, a prepared copy, and enrols. The enrolment service writes the authoritative record, and later requests check it before returning lesson details." },
        { label: "Watch through the CDN", text: "The lesson page returns a media manifest for version 7 of the lesson. Segments are fixed files, so the CDN serves them from a nearby cache." },
        { label: "Report progress", text: "Every 30 seconds the player sends a checkpoint with a key such as `device-session:lesson:420`. If the phone is offline, it resends later, and the same key means the same event is not counted twice." },
        { label: "Take the quiz", text: "The learner submits answers for question-set version 3. The service marks them against that version, stores the score beside the version number, and the learner can resume on another device from the stored position." },
      ],
    },
    example: {
      title: "Worked example: why a quiz needs a version",
      text: "A quiz has 10 questions. A learner answers question 4 as B and scores 8 out of 10. Next week, the author corrects question 4 so that C is right. If the old attempt was stored only as \"B for question 4\" with no version, it would now look wrong, and the learner's score would silently change. By storing the question-set version with every attempt, the 8 out of 10 stays explainable, and new attempts use version 4. The same thinking applies to progress. If a phone sends a 420-second checkpoint three times after a poor connection, a unique event key means progress moves to 420 seconds once, not 1,260.",
    },
    tradeoff: {
      title: "Shared content against personal records",
      gain: {
        label: "Splitting them gains",
        items: [
          "Lessons and the catalogue scale cheaply through caches and a CDN",
          "Personal data stays in one exact, access-controlled place",
          "A catalogue outage does not lose anyone's progress",
        ],
      },
      cost: {
        label: "Splitting them costs",
        items: [
          "The catalogue copy can be briefly out of date after publishing",
          "Two different data paths to build and secure",
          "Revoked enrolment must also be enforced on cached content links",
        ],
      },
    },
    pitfalls: [
      "Counting a lesson as complete only when a video reaches its end, so skipping to the final second finishes it.",
      "Editing quiz questions in place and losing which version a learner answered.",
      "Adding every retried progress report together, so offline retries inflate completion.",
    ],
    remember: [
      "Cache what is the same for everyone. Protect what is personal.",
      "Make progress events safe to repeat.",
      "Version quizzes and store the version with each attempt.",
      "Check enrolment on every request for private content.",
    ],
    interview: [
      "Trace catalogue search, enrolment, video playback, cross-device resume and one quiz submission, without claiming any named platform's private design.",
      "Say how you handle a learner whose access is revoked while a video is playing.",
    ],
    quizzes: [
      {
        question: "A phone sends the same progress checkpoint three times after reconnecting. What keeps progress correct?",
        options: [
          "Adding all three reports together into one larger progress total",
          "Ignoring every report sent after a disconnection",
          "A unique event key, so repeats count as the same event",
          "Asking the learner to watch the lesson again",
        ],
        answer: 2,
        why: "A key identifies each event, so retrying is safe and progress is counted once.",
      },
      {
        question: "An author changes the right answer to a quiz question. Why must old attempts store the question-set version?",
        options: [
          "It lets the platform allow only one attempt per learner",
          "Old scores stay explainable instead of silently changing",
          "Versions are required before videos can be played",
          "It makes future quizzes shorter for every learner",
        ],
        answer: 1,
        why: "Without the version, a past answer would be judged against a rule that did not exist when it was given.",
      },
      {
        question: "Why can lesson video segments go through a CDN while quiz scores cannot?",
        options: [
          "Quiz scores are far too large for any cache to hold, even a very big one",
          "Segments change every minute, so caches suit them",
          "Segments are the same for all and fixed; scores are private and exact",
          "CDNs are unable to store numbers of any kind",
        ],
        answer: 2,
        why: "Shared fixed files are safe to copy widely. Personal data needs access checks and accuracy that caches cannot guarantee.",
      },
    ],
  },
  {
    slug: "case-ai-products-and-agents",
    title: "Case: AI Assistants and Agents",
    summary: "Design support, research, coding and interview assistants from one safe architecture vocabulary.",
    intro: [
      "AI assistants look different on the surface, but they are built from the same few parts. A support assistant answers questions from approved documents. A research assistant gathers and compares sources. A coding assistant proposes changes to files. An interview coach listens to a candidate and gives feedback. In each case a model sits inside a system of retrieval, tools, limits and review.",
      "What changes between products is the risk, and the risk decides the design. A support assistant mostly needs good evidence and a way to hand over to a person. A coding assistant needs a sandbox, because it runs code. A coach needs consent and careful handling of recordings. Start with one assistant and one bounded job, measure it, and add more only when the tasks truly are independent.",
    ],
    analogy: [
      "A supervised team at a reference desk",
      "The staff may consult approved books and tools, but risky actions need a supervisor's agreement, and every answer says which book it came from.",
    ],
    glossary: [
      ["grounding", "Basing an answer on retrieved evidence and showing where it came from."],
      ["trust boundary", "The line between things the system controls and things it must treat as untrusted, such as user text and model output."],
      ["sandbox", "A locked-down environment where code can run without being able to harm the rest of the system."],
      ["handoff", "Passing a conversation to a human when the assistant should not or cannot continue."],
      ["evaluation set", "A fixed collection of realistic cases used to score the assistant before and after each change."],
    ],
    walkthrough: {
      title: "Follow one support question",
      steps: [
        { label: "Scope the job", text: "A customer asks about a refund. The assistant is limited to the support handbook and the customer's own orders, and the first step is to decide whether the question is inside that scope." },
        { label: "Retrieve evidence", text: "The assistant retrieves the refund policy passages and the customer's order, checking the customer may see them. If nothing relevant is found, it says so." },
        { label: "Answer with limits", text: "It drafts an answer with a link to the policy it used. A refund itself is a tool call that needs a person's approval, so the assistant can only propose it." },
        { label: "Escalate and learn", text: "If the customer is upset or the policy is unclear, the conversation is handed to a person with the evidence attached. Afterwards the case can join the evaluation set." },
      ],
    },
    example: {
      title: "Worked example: the same parts, different risk",
      text: "Take four assistants. The support assistant reads documents and proposes actions, so its main risks are wrong evidence and unapproved refunds. The research assistant runs 5 searches in parallel, so it must cap the fan-out and keep a list of sources. The coding assistant edits files and runs tests, so it works in a sandbox and its changes are reviewed as a patch before they land. The interview coach records speech, so consent and deletion matter, and its feedback must quote what the candidate actually said. The shared pieces are the same: a gateway, retrieval with permission checks, tools with limits, and evaluation. Only the weight on each piece differs.",
    },
    tradeoff: {
      title: "One bounded assistant or a team of agents",
      gain: {
        label: "One bounded assistant gains",
        items: [
          "Simple to test, trace and explain",
          "Lower cost and delay per task",
          "Clear boundaries for what it may read and do",
        ],
      },
      cost: {
        label: "One bounded assistant costs",
        items: [
          "A single job cannot cover every kind of request",
          "Large tasks may need to be split between several steps",
          "Some requests will be refused or handed to a person",
        ],
      },
    },
    pitfalls: [
      "Building a society of cooperating agents before one bounded workflow is reliable and measured.",
      "Letting the assistant act on user text without a trust boundary, so pasted instructions steer its tools.",
      "Skipping the handoff to a human, so the assistant keeps answering questions it cannot handle.",
    ],
    remember: [
      "Pick the job, the evidence and the limits first, then the model.",
      "Risk decides the design: sandbox for code, consent for recordings, approval for actions.",
      "Always show the evidence an answer came from.",
      "Know when the assistant refuses or hands over.",
    ],
    interview: [
      "Choose one AI product, draw its trust boundaries and say when it refuses or escalates.",
      "Explain why you would start with one agent instead of several.",
    ],
    quizzes: [
      {
        question: "A coding assistant can run the code it writes. What is the most important safeguard?",
        options: [
          "A friendly and reassuring tone in every reply it writes",
          "A larger context window so it can read more files",
          "A longer system prompt that lists what is forbidden",
          "A sandbox, so the code cannot harm the rest of the system",
        ],
        answer: 3,
        why: "Model-written code is untrusted. A sandbox contains what it can reach, whatever it does.",
      },
      {
        question: "A support assistant finds no policy that covers a customer's odd question. What should it do?",
        options: [
          "Invent a plausible policy so the customer is satisfied",
          "Say it could not find an answer and offer a person",
          "Answer using another company's published policy instead",
          "Refuse every future question from that customer",
        ],
        answer: 1,
        why: "An invented policy could mislead the customer. Admitting a gap and escalating is the safe behaviour.",
      },
      {
        question: "Why start with a single bounded assistant rather than many cooperating agents?",
        options: [
          "Single assistants are always more accurate than teams of cooperating agents",
          "Multiple agents cannot be given any tools to use",
          "A single assistant never needs any evaluation at all",
          "It is simpler to test, measure and explain before adding more",
        ],
        answer: 3,
        why: "Each extra agent multiplies cost and failure paths. A reliable single workflow gives a measured base to build on.",
      },
    ],
  },
];
