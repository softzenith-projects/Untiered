import type { LessonSpec } from "@/content/courses/system-design/lesson";

/**
 * Inside the data layer: what happens beneath the database API. Added on 28 October 2026
 * after a coverage review found the course said nothing about ID generation, storage
 * engines or probabilistic structures — three topics that come up in design interviews
 * as soon as a candidate mentions sharding, write-heavy workloads or "count unique users".
 */
export const dataInternals: LessonSpec[] = [
  {
    slug: "unique-ids-at-scale",
    title: "Unique IDs Without a Single Counter",
    summary: "Give every record a unique ID when many machines create records at the same time.",
    intro: [
      "Every order, message and upload needs an ID that no other record will ever share. With one database the answer is easy: let it count up — 1, 2, 3. But once ten servers create records at the same time, or the data is split across many databases, there is no longer one counter everyone can ask without waiting in a queue.",
      "So systems use IDs that each machine can make on its own. The two common families are random IDs, which are unique because the chance of a repeat is vanishingly small, and time-ordered IDs, which put the creation time first so that newer IDs sort after older ones. Which one you pick changes how fast your database writes, how easily you can sort, and what an outsider can learn from an ID.",
    ],
    analogy: [
      "Numbering tickets in many shops",
      "One shop can hand out ticket 1, 2, 3 from a single roll. A chain of fifty shops cannot share one roll without phoning head office for every ticket. Instead, each shop prints its own tickets as date, time, shop number and a running count — no two shops can ever print the same ticket, and nobody has to phone anyone.",
    ],
    glossary: [
      ["auto-increment ID", "A number the database raises by one for each new row. Simple, but it needs one place that does the counting."],
      ["UUID", "A 128-bit identifier. The random kind (version 4) is unique because 122 random bits almost never repeat."],
      ["time-ordered ID", "An ID whose first part is the creation time, so sorting by ID also sorts by age."],
      ["worker number", "A small number given to each machine so that two machines never produce the same ID in the same moment."],
    ],
    walkthrough: {
      title: "Follow one ID being made without asking anyone",
      steps: [
        { label: "Read the clock", text: "A server receives a new order at 10:15:02.317. It takes the current time in milliseconds as the first part of the ID." },
        { label: "Add who made it", text: "It appends its own worker number, say 37, which no other running server uses. Two servers can now never clash, even at the same millisecond." },
        { label: "Add a sequence", text: "If this server already made an ID in the same millisecond, it adds 1 to a small counter that resets every millisecond. The order gets the next number." },
        { label: "Store and sort", text: "The finished ID is saved with the order. Because time comes first, new IDs land at the end of the database index instead of being scattered through it." },
      ],
    },
    example: {
      title: "Worked example: how many IDs per second?",
      text: "One common 64-bit layout spends 41 bits on milliseconds since a chosen start date (enough for about 69 years), 10 bits on the worker number (up to 1,024 machines) and 12 bits on the sequence (4,096 IDs per millisecond per machine). That is over 4 million IDs per second from a single machine with no network call at all. The price is that the layout depends on the clock: if a machine's clock jumps backwards, it could repeat an ID it already issued, so the generator must refuse to issue IDs until the clock catches up.",
    },
    tradeoff: {
      title: "Random IDs or time-ordered IDs?",
      gain: {
        label: "Random IDs (UUID v4)",
        items: [
          "Need no clock and no worker numbers — any machine, any time",
          "Reveal nothing about when or where the record was made",
          "Insert at random places in an index, which slows large tables",
        ],
      },
      cost: {
        label: "Time-ordered IDs",
        items: [
          "Sort by creation time for free, which helps feeds and pagination",
          "Append to the end of an index, which keeps writes fast",
          "Depend on reasonably correct clocks and unique worker numbers",
        ],
      },
    },
    artifact: {
      kind: "table",
      head: ["Approach", "Unique because", "Watch out for"],
      rows: [
        ["Auto-increment", "One database counts every row", "The counter becomes a bottleneck, and IDs show how many records exist"],
        ["Random UUID", "Repeats are astronomically unlikely", "Scattered index inserts, and 16 bytes per ID"],
        ["Time + worker + sequence", "Each machine has its own number", "Clocks that jump backwards, and handing out worker numbers"],
      ],
    },
    pitfalls: [
      "Showing auto-increment IDs in public URLs. Anyone can guess the next one and estimate how many orders you take each day.",
      "Ignoring the clock. A time-ordered generator that keeps issuing IDs after its clock steps backwards can produce duplicates.",
      "Giving two running machines the same worker number, which quietly breaks the guarantee for both.",
    ],
    remember: [
      "One counter works for one database; many writers need IDs they can make alone.",
      "Random IDs are simple and private; time-ordered IDs sort and index well.",
      "Time-ordered IDs are only as good as the clock and the worker numbers.",
      "Do not let an ID leak business numbers you would not publish.",
    ],
    interview: [
      "When a design shards data, say how IDs are generated before anyone asks — it shows you noticed the single counter has gone.",
      "Explain one layout bit by bit (time, worker, sequence) and name its weakness: clock drift.",
    ],
    quizzes: [
      {
        question: "Orders are split across eight databases. Why is each database's own auto-increment counter a problem?",
        options: [
          "Each database would issue the same numbers, so order 42 would exist eight times",
          "Auto-increment only works for tables with fewer than eight columns",
          "Counters are too slow to work on more than one machine at once",
          "The eight counters would always produce IDs in random order",
        ],
        answer: 0,
        why: "Every database starts counting from 1 independently, so the same number appears in each one. IDs must be unique across the whole system, not only inside one database.",
      },
      {
        question: "A server's clock is corrected and jumps back two seconds. What should a time-ordered ID generator do?",
        options: [
          "Carry on as normal, since the sequence number prevents repeats",
          "Wait to issue IDs until its clock passes the last time it used",
          "Switch every server to a random worker number for a while",
          "Reset the sequence counter to zero and continue issuing IDs",
        ],
        answer: 1,
        why: "Times in those two seconds were already used, so the same time, worker and sequence could be produced again. Refusing to issue IDs until the clock is past the last used time keeps every ID unique.",
      },
      {
        question: "Why do random UUIDs make inserts into a very large index slower than time-ordered IDs?",
        options: [
          "Random UUIDs are too long to be stored in an index",
          "Each new ID lands at a random spot, touching pages all over the index",
          "Indexes cannot store any value that contains letters",
          "Random UUIDs must be checked against every existing row first",
        ],
        answer: 1,
        why: "An index keeps values in sorted order. Random IDs belong anywhere in that order, so each insert touches a different part of the index, while time-ordered IDs keep adding at the end.",
      },
    ],
  },
  {
    slug: "storage-engines",
    title: "Storage Engines: Logs, B-Trees and LSM Trees",
    summary: "See how a database turns a write into bytes on disk, and why that choice shapes speed.",
    intro: [
      "Under every database is a storage engine: the part that decides how rows are laid out on disk and how a change survives a power cut. You rarely choose it directly, but it explains why one database is happy with a flood of writes while another shines at reads, and why both still write every change to a log first.",
      "Two designs dominate. A B-tree keeps data sorted in fixed-size pages and updates those pages in place, which makes reads quick and predictable. An LSM tree collects writes in memory, then flushes them to disk as new sorted files and merges the files later, which makes writes very cheap. Knowing the difference lets you explain a database choice with more than a brand name.",
    ],
    analogy: [
      "A filing cabinet or an inbox tray",
      "A B-tree is a tidy filing cabinet: every new paper is filed in exactly the right folder straight away, so finding it later is quick, but filing takes effort each time. An LSM tree is an inbox tray: you drop papers in instantly and sort the whole pile into the cabinet once a day — fast to add, but looking for a paper may mean checking the tray and the cabinet.",
    ],
    glossary: [
      ["write-ahead log (WAL)", "A file where every change is appended before the data itself is changed, so a crash can be recovered by replaying it."],
      ["page", "A fixed-size block of the data file, often a few kilobytes, that is read and written as one unit."],
      ["B-tree", "A sorted tree of pages that is updated in place, giving fast lookups and range scans."],
      ["LSM tree", "A design that buffers writes in memory, flushes them as sorted files and merges those files in the background."],
      ["compaction", "Merging several sorted files into one, dropping overwritten and deleted values."],
    ],
    walkthrough: {
      title: "Follow one write through an LSM-tree engine",
      steps: [
        { label: "Append to the log", text: "A user changes their display name. The engine first appends the change to the write-ahead log on disk, so it cannot be lost even if the machine dies next." },
        { label: "Write to memory", text: "It then updates an in-memory sorted table. The write is now complete from the user's point of view — no data file was touched." },
        { label: "Flush a sorted file", text: "When the memory table fills, the engine writes it to disk as a new, sorted, never-changed file and starts a fresh memory table." },
        { label: "Compact later", text: "In the background, older files are merged. The old display name is dropped, keeping only the latest value, so reads have fewer files to check." },
      ],
    },
    example: {
      title: "Worked example: a write-heavy sensor table",
      text: "A fleet of 50,000 sensors each reports a reading every 10 seconds — 5,000 writes a second, almost never read back individually. A B-tree would find and rewrite a page for every reading. An LSM engine appends to its log, updates memory, and later writes large sorted files in one go, which suits this pattern well. If the same table were instead read constantly by key and rarely written, the B-tree's single sorted structure would usually answer faster, because an LSM read may have to look in memory and in several files before it finds the newest value.",
    },
    tradeoff: {
      title: "B-tree or LSM tree?",
      gain: {
        label: "B-tree",
        items: [
          "Each key lives in one place, so reads are fast and predictable",
          "Range scans walk sorted pages directly",
          "Writes cost more: a page is found and rewritten for each change",
        ],
      },
      cost: {
        label: "LSM tree",
        items: [
          "Writes are cheap appends and large sequential flushes",
          "Reads may check memory and several files for the newest value",
          "Compaction uses disk and CPU in the background",
        ],
      },
    },
    pitfalls: [
      "Assuming a write is safe once it is in memory. Without the write-ahead log, a crash loses everything not yet flushed.",
      "Picking an engine by reputation instead of by the read and write mix the product actually has.",
      "Forgetting compaction when sizing disks and CPU, then being surprised when background merges slow everything down.",
    ],
    remember: [
      "Log first, then change the data: that is how databases survive crashes.",
      "B-trees update sorted pages in place and favour reads.",
      "LSM trees buffer, flush and merge, and favour writes.",
      "Match the engine to the workload's read and write mix.",
    ],
    interview: [
      "If a design is write-heavy, mention that log-structured storage suits it and say why — sequential writes instead of page rewrites.",
      "Show you know the cost of each choice: LSM reads may touch several files, and compaction needs spare capacity.",
    ],
    quizzes: [
      {
        question: "Why does a database append a change to its write-ahead log before changing the data file?",
        options: [
          "So that a crash halfway through can be repaired by replaying the log",
          "Because the data file can only be changed once each day",
          "So that the change is compressed before it reaches the disk",
          "Because reads are always served from the log instead of the data",
        ],
        answer: 0,
        why: "If the machine fails while the data file is half updated, the log still holds the full change. On restart the engine replays the log and the data ends up consistent.",
      },
      {
        question: "In an LSM-tree engine, why might reading one key be slower than in a B-tree?",
        options: [
          "LSM engines keep no index of any kind for their keys",
          "The newest value could be in memory or in any of several files",
          "Each read in an LSM engine must first wait for compaction to finish",
          "LSM engines store every key twice, once in each of two copies",
        ],
        answer: 1,
        why: "Writes are spread across the memory table and several sorted files until compaction merges them, so a read may need to check more than one place to find the latest value.",
      },
      {
        question: "What does compaction remove when it merges sorted files?",
        options: [
          "The write-ahead log entries for changes not yet flushed",
          "Every key that has not been read in the last hour",
          "Older versions of a key that a newer write has replaced",
          "The memory table that is currently receiving new writes",
        ],
        answer: 2,
        why: "When the same key appears in several files, only the newest value matters. Compaction keeps that one and drops the overwritten and deleted entries, so later reads check fewer files.",
      },
    ],
  },
  {
    slug: "bloom-filters-and-sketches",
    title: "Bloom Filters and Sketches: Good-Enough Answers",
    summary: "Trade a small, known error for huge savings in memory and lookups.",
    intro: [
      "Some questions are expensive to answer exactly. Has this username ever been registered? How many different people visited today? Which search terms are most popular this hour? An exact answer can mean storing every item ever seen. A sketch is a small data structure that stores a compressed summary instead and gives an answer that is nearly right, with an error you can calculate in advance.",
      "Three sketches cover most needs. A Bloom filter answers \"have I seen this?\" with \"definitely not\" or \"probably yes\". A HyperLogLog estimates how many different items there were. A count-min sketch estimates how often each item appeared. Each uses a fixed, small amount of memory however many items arrive — the skill is knowing when \"nearly right\" is good enough.",
    ],
    analogy: [
      "A guest list of initials",
      "Instead of a full guest list, a doorkeeper keeps a card of initials that have been invited. If your initials are not on the card, you were definitely not invited. If they are, you probably were — but someone else with the same initials might have been the real guest, so for important doors the doorkeeper then checks the full list.",
    ],
    glossary: [
      ["Bloom filter", "A bit array plus a few hash functions that says an item is definitely absent or probably present."],
      ["false positive", "The structure says \"probably present\" for an item that was never added. Bloom filters can do this; they never miss an item that was added."],
      ["HyperLogLog", "A sketch that estimates how many distinct items it has seen, using a few kilobytes of memory."],
      ["count-min sketch", "A small table of counters that estimates how often each item occurred, possibly too high but never too low."],
    ],
    walkthrough: {
      title: "Follow one username check through a Bloom filter",
      steps: [
        { label: "Hash the name", text: "Someone tries to sign up as `priya_k`. The service runs the name through three hash functions and gets three positions in a bit array, say 12, 907 and 4,410." },
        { label: "Check the bits", text: "If any of those three bits is 0, the name was never added — it is definitely free, and the database is not touched at all." },
        { label: "Confirm on \"maybe\"", text: "If all three bits are 1, the name is probably taken. Because that could be a false positive, the service checks the real users table before saying no." },
        { label: "Add on success", text: "When the account is created, the service sets those three bits to 1, so the next check for `priya_k` says \"probably present\"." },
      ],
    },
    example: {
      title: "Worked example: skipping disk reads",
      text: "A storage engine keeps 200 sorted files on disk. Without help, looking up a key that does not exist would mean checking every file. With a Bloom filter per file sized for a 1% false-positive rate, which takes roughly 10 bits per key, the engine checks 200 small in-memory filters first. For a missing key, it expects to open only about 2 of the 200 files (1% of 200) instead of all of them. The cost is memory for the filters and the occasional wasted read when a filter says \"probably\" and is wrong.",
    },
    tradeoff: {
      title: "What a sketch buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Fixed, small memory however many items arrive",
          "Very fast answers without reading the full data",
          "An error rate you choose and can calculate in advance",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Answers are approximate, so they cannot settle money or permissions",
          "A standard Bloom filter cannot remove an item once added",
          "The error grows if the structure is sized too small for the data",
        ],
      },
    },
    artifact: {
      kind: "table",
      head: ["Question", "Sketch", "How it can be wrong"],
      rows: [
        ["Have I seen this item?", "Bloom filter", "May say \"probably yes\" for a new item; never says \"no\" for a seen one"],
        ["How many different items?", "HyperLogLog", "Off by a small percentage, in either direction"],
        ["How often did this item appear?", "Count-min sketch", "May count too high when items collide; never too low"],
      ],
    },
    pitfalls: [
      "Trusting a Bloom filter's \"probably yes\" as a final answer where a false positive matters, instead of confirming with the real data.",
      "Sizing a Bloom filter for today's data. Once far more items are added than planned, most bits become 1 and almost everything looks present.",
      "Using an estimate where an exact figure is required, such as a bill or an account balance.",
    ],
    remember: [
      "A Bloom filter says \"definitely not\" or \"probably yes\".",
      "HyperLogLog counts distinct items; count-min estimates how often each appears.",
      "Sketches use fixed small memory and give a known, bounded error.",
      "Use them to avoid expensive work, not to decide anything exact.",
    ],
    interview: [
      "When a design must count unique visitors or check membership in a huge set, offer a sketch and state the error it accepts.",
      "Say where you confirm a \"maybe\" against the real data, so the approximation never reaches a decision that must be exact.",
    ],
    quizzes: [
      {
        question: "A Bloom filter says a username is \"probably present\". What can you safely conclude?",
        options: [
          "The username is definitely taken, so reject it straight away",
          "It may be taken, so check the real users table to be sure",
          "The filter is full and should be rebuilt before any checks",
          "The username is definitely free, as filters report the opposite",
        ],
        answer: 1,
        why: "\"Probably present\" can be a false positive caused by other names setting the same bits. Only \"definitely not\" is certain, so a maybe must be confirmed against the real data.",
      },
      {
        question: "A dashboard needs the number of different users who visited today, out of hundreds of millions of visits. Which tool fits?",
        options: [
          "A Bloom filter, counting how many of its bits are set",
          "A count-min sketch of how often each user visited",
          "A HyperLogLog, which estimates distinct items in little memory",
          "A sorted list of every visit, scanned once at midnight",
        ],
        answer: 2,
        why: "Counting distinct items is exactly what HyperLogLog is built for, and it does it in a few kilobytes with a small percentage error. A sorted list of every visit would be exact but enormous.",
      },
      {
        question: "Why does a count-min sketch sometimes report a count that is too high, but never too low?",
        options: [
          "Different items can share a counter, which only adds to it",
          "It rounds every count up to the next power of two",
          "Old counts are deleted, which can only make totals rise",
          "It counts each item twice to make sure none are missed",
        ],
        answer: 0,
        why: "Each item increases a few counters, and other items can land on the same ones. Sharing only adds extra, so the smallest of an item's counters is at least its true count, never below it.",
      },
    ],
  },
];
