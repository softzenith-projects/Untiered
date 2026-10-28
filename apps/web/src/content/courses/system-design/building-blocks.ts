import type { ChapterSource } from "@/content/courses/system-design/lesson";
import { legacyDetails } from "@/content/courses/system-design/legacy-details";

export const buildingBlocks: ChapterSource[] = [
  {
    slug: "network-protocols",
    title: "HTTP, TCP, UDP and Realtime Connections",
    summary: "Choose how messages travel by asking whether order, delivery and low delay matter most.",
    intro: [
      "A protocol is an agreed set of rules for sending messages. TCP builds a connection, numbers the bytes, and resends anything that goes missing, so the receiver sees a complete, ordered stream. UDP just sends separate packets, called datagrams, and makes no promise that any of them arrive or arrive in order. HTTP sits above these: it defines requests and responses, and is normally carried over TCP.",
      "Reliability is not free. To keep order, TCP makes later data wait while a lost piece is resent, which adds delay. UDP skips that, so it can be quicker, but any reliability you need must then be built by you. The right choice depends on one question: if this message is late or lost, is it better to wait for it, or to move on to a newer one?",
    ],
    analogy: [
      "Registered post, postcards and a phone call",
      "Registered post is tracked and resent if it goes missing, which is slow but safe. A postcard is quick, but some may simply vanish. A phone call keeps one line open so you can talk back and forth. Each is right for a different kind of message.",
    ],
    glossary: [
      ["protocol", "The rules both sides follow when they exchange messages."],
      ["TCP", "A connection that delivers bytes in order and resends anything that is lost."],
      ["UDP", "A way of sending independent packets with no built-in promise of delivery or order."],
      ["HTTP", "A request-and-response message format, usually carried over a TCP connection."],
      ["latency", "The time a message takes to get from one side to the other."],
    ],
    walkthrough: {
      title: "Follow two messages from a taxi app",
      steps: [
        { label: "Confirm a booking", text: "The rider taps Book. The app sends an HTTP request over a secure TCP connection. If a packet is lost, TCP resends it, and the app only sees the complete message." },
        { label: "Reply must not vanish", text: "The server's confirmation also travels over TCP. A confirmation that silently disappeared would leave the rider unsure, so waiting a little for a resend is the right trade." },
        { label: "Send the driver's position", text: "Every two seconds the driver's phone sends a location update. These are small and each one replaces the one before it." },
        { label: "Let a late update go", text: "If one update is lost, resending it is pointless: the next update, two seconds later, is fresher. For this message, moving on beats waiting, which is the case for a UDP-style approach." },
      ],
    },
    example: {
      title: "Worked example: the cost of waiting for a lost packet",
      text: "A live video call sends 30 frames a second, so a new frame arrives about every 33 ms. Suppose one packet is lost and the network takes 150 ms to notice and resend it. With TCP, everything behind that packet waits, so the picture freezes for roughly 150 ms and then rushes forward. With a UDP-based approach, the call simply shows a small glitch and carries on with the next frame, because an old frame is worthless by the time it would arrive. Now compare a bank transfer request: losing half of it would be a disaster, so it uses reliable HTTP over TCP and happily waits.",
    },
    tradeoff: {
      title: "Reliable delivery against low delay",
      gain: {
        label: "You gain",
        items: [
          "TCP gives complete, ordered data without extra code from you",
          "UDP avoids waiting behind a lost packet, so fresh data arrives sooner",
          "HTTP gives a widely understood format that tools, caches and browsers support",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "TCP can stall later data while it waits for a resend",
          "UDP leaves loss, order and duplicates for your own code to handle",
          "A long-lived connection uses server memory even while it is quiet",
        ],
      },
    },
    pitfalls: [
      "Choosing UDP only because it is called fast, then rebuilding reliability badly in application code.",
      "Sending an important command, such as a payment, over a channel that can silently drop it.",
      "Ignoring reconnects, so a phone that changes from Wi-Fi to mobile data loses its session or repeats an action.",
    ],
    remember: [
      "TCP: complete and ordered, at the price of waiting.",
      "UDP: fast and light, but loss and order are your problem.",
      "HTTP describes the conversation; TCP usually carries it.",
      "Ask: is an old message still useful if it arrives late?",
    ],
    interview: [
      "Give one message that must arrive and one that may be replaced by a newer value, then choose a transport for each and say why.",
      "Mention reconnect behaviour and timeouts. A design that ignores a dropped connection is incomplete.",
    ],
    quizzes: [
      {
        question: "A game sends the player's position 30 times a second. One update is lost on the way. What is the best handling?",
        options: [
          "Pause the whole game until the lost update is resent",
          "Ask the server to resend all earlier updates in order",
          "Ignore it and use the next update, already newer",
          "Close the connection and ask the player to log in again",
        ],
        answer: 2,
        why: "A position update is replaced by the next one within a fraction of a second, so resending the lost one adds delay and no value. Waiting for it is the wrong trade for this kind of message.",
      },
      {
        question: "A payment request is sent and part of it is lost on the network. Why is TCP a good fit here?",
        options: [
          "TCP always delivers messages faster than any other method",
          "TCP resends missing data, so the server gets it all",
          "TCP removes the need for any security or login checks",
          "TCP lets the client send the same payment several times safely",
        ],
        answer: 1,
        why: "TCP notices missing pieces and resends them, so the receiver sees the full message in order. It is not faster, and it does not make repeated payments safe; that needs an idempotency key.",
      },
      {
        question: "Which statement about HTTP and TCP is correct?",
        options: [
          "HTTP and TCP are two names for the same thing",
          "HTTP is a faster replacement for TCP on modern networks",
          "TCP describes web pages, and HTTP only describes email",
          "HTTP defines the requests, and TCP usually carries them",
        ],
        answer: 3,
        why: "HTTP is the format of the conversation, with requests and responses. TCP is the layer underneath that moves the bytes reliably. They work together and are not interchangeable.",
      },
    ],
  },
  {
    slug: "proxies-and-service-discovery",
    title: "Proxies and Service Discovery",
    summary: "Find healthy service instances without teaching every caller where machines live.",
    intro: [
      "A proxy is a go-between. A forward proxy acts on behalf of clients: a school network might send all student traffic through one. A reverse proxy acts on behalf of servers: it receives requests from outside and passes them to the right machine inside. Service discovery is a live directory that maps a service name, such as `inventory`, to the machines currently running it.",
      "In modern systems, machines are replaced, moved and restarted all the time, so their addresses keep changing. If every caller stored addresses, each change would break someone. Putting a proxy and a discovery layer in the middle means callers use a stable name, and routing, certificates and traffic rules live in one place instead of in every application.",
    ],
    analogy: [
      "A hotel front desk and room directory",
      "Guests ask the front desk for the restaurant instead of memorising where each staff member stands. The desk knows who is on duty today and forwards the request. If a waiter goes on a break, the desk stops sending guests to them.",
    ],
    glossary: [
      ["forward proxy", "An intermediary that sends requests on behalf of clients."],
      ["reverse proxy", "An intermediary that receives requests on behalf of one or more servers."],
      ["service discovery", "A changing directory that maps a service name to its currently healthy instances."],
      ["readiness", "A signal that an instance is able to accept traffic right now."],
    ],
    walkthrough: {
      title: "Follow a new instance joining the pool",
      steps: [
        { label: "Instance starts", text: "A new copy of the `inventory` service starts on a machine with a fresh address, 10.2.4.31. Nothing sends it traffic yet." },
        { label: "Register", text: "Once it has loaded its settings and connected to its database, the instance reports itself as ready and is added to the directory under the name `inventory`." },
        { label: "Caller asks by name", text: "The order service calls `inventory`. Discovery returns the ready instances, and the proxy picks one, preferring a machine in the same zone." },
        { label: "Failure removes it", text: "Later the new instance fails its readiness check. The directory drops it, so new requests stop going there, and callers never needed to know." },
      ],
    },
    example: {
      title: "Worked example: three instances, one fails",
      text: "The order service calls `inventory`, never `10.2.4.17`. Discovery lists three ready instances: A and B in zone 1, C in zone 2. The proxy sends the call to A, which is in the same zone as the caller and so has the shortest trip. Suppose A crashes. Its entry has a short expiry of, say, ten seconds, and it is not renewed, so A disappears from the list. Until then a few calls might still fail, so the caller retries on another instance. If a record never expired, callers would keep sending traffic to a machine that no longer exists.",
    },
    tradeoff: {
      title: "A shared routing layer helps and adds a dependency",
      gain: {
        label: "You gain",
        items: [
          "Callers use stable names, even as machines come and go",
          "Security, routing and limits are managed in one place",
          "Failed instances are removed from use automatically",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "The proxy and directory are now important parts that must stay up",
          "Every proxy adds a small delay to each request",
          "Stale directory entries can send traffic to machines that are gone",
        ],
      },
    },
    pitfalls: [
      "Hard-coding instance IP addresses in callers, even though machines are replaced and rescheduled.",
      "Letting directory entries live forever, so dead instances keep receiving traffic.",
      "Making the proxy a single point of failure by running only one copy of it.",
    ],
    remember: [
      "Callers use a name, not an address.",
      "A reverse proxy stands for servers; a forward proxy stands for clients.",
      "Directory entries must expire if they are not renewed.",
      "Run more than one proxy, or it becomes the weak link.",
    ],
    interview: [
      "Explain how a newly started instance begins receiving traffic and how a failed one stops, step by step.",
      "Distinguish a reverse proxy from service discovery. They are related but they solve different problems.",
    ],
    quizzes: [
      {
        question: "A service's machines are replaced every few hours with new addresses. What keeps callers working without changes?",
        options: [
          "Giving each caller a printed list of every machine address",
          "Asking operators to update every caller after each replacement",
          "Calling a stable name that discovery maps to live instances",
          "Keeping the same machines forever and never replacing them",
        ],
        answer: 2,
        why: "A stable name decouples callers from addresses. Discovery tracks which instances are live, so replacements happen without touching any caller.",
      },
      {
        question: "Which describes a reverse proxy?",
        options: [
          "It hides the server's identity from a user's browsing history",
          "It takes outside requests and passes them to inside servers",
          "It stores a user's passwords so they do not retype them",
          "It converts a domain name into a network address",
        ],
        answer: 1,
        why: "A reverse proxy stands in front of servers and forwards requests to them. Turning names into addresses is DNS, and a forward proxy is the one that acts for clients.",
      },
      {
        question: "A crashed instance stays in the directory for an hour because entries never expire. What is the effect?",
        options: [
          "Callers keep being sent to a dead machine, so calls fail",
          "The directory repairs the crashed instance automatically",
          "Traffic is spread more evenly, since there is one more entry",
          "Nothing, because proxies ignore the directory completely",
        ],
        answer: 0,
        why: "Stale entries send real requests to a machine that cannot answer. Expiry, or health checks that remove failing instances, keeps the list close to the truth.",
      },
    ],
  },
  {
    slug: "scale-up-and-scale-out",
    title: "Scale Up and Scale Out",
    summary: "Know when a larger machine helps and when work must spread across machines.",
    intro: [
      "Scaling up, also called vertical scaling, means giving one machine more power: more CPU cores, more memory, faster disks. Scaling out, or horizontal scaling, means adding more machines and sharing the work among them. Real systems use both, at different layers.",
      "Scaling up is simple, because nothing about the program changes. But one machine has a ceiling and is a single point of failure. Scaling out has no such ceiling, yet it needs the work to be spread fairly and each machine to avoid keeping private state, since the next request may go to a different one. The skill is to find which resource is actually running out before you pay for more of anything.",
    ],
    analogy: [
      "A bigger bus or more buses",
      "A bigger bus is easy: same driver, same route, more seats. But roads, garages and drivers all have limits on bus size. More buses add capacity without a size limit, but now you need timetables, stops and a way to share passengers evenly.",
    ],
    glossary: [
      ["vertical scaling", "Giving one machine more CPU, memory or storage."],
      ["horizontal scaling", "Adding more machines that share the work."],
      ["stateless service", "A service that keeps nothing between requests in its own memory, so any copy can answer."],
      ["headroom", "Spare capacity kept in reserve for bursts and failures."],
      ["bottleneck", "The one resource that runs out first and limits the whole system."],
    ],
    walkthrough: {
      title: "Follow an API as traffic grows",
      steps: [
        { label: "Measure first", text: "At peak the single API machine reaches 80 per cent CPU while memory and network are fine. The CPU is the bottleneck." },
        { label: "Scale up once", text: "Moving from 4 to 8 cores is a quick fix with no code change. It buys time, but the machine is still one machine, and one crash takes the service down." },
        { label: "Make it stateless", text: "To run several copies, login sessions move out of the machine's memory into shared storage, so any copy can handle the next request." },
        { label: "Scale out", text: "Three replicas run behind a load balancer. If one fails, the other two carry on, and capacity can be raised by adding a fourth." },
      ],
    },
    example: {
      title: "Worked example: when a bigger machine stops helping",
      text: "An API serves 800 requests per second on one 8-core machine at about 70 per cent CPU. Traffic is expected to double. Doubling the cores might work for now, but those machines get disproportionately expensive and there is a limit to size. Instead, run three machines of 8 cores: capacity is about three times, and after doubling, 1,600 requests per second spread over three gives about 530 each, and if one fails the other two carry about 800 each, the same load as today. But if the database behind them is already at 90 per cent, extra API machines only push more load into it. The measured bottleneck decides which kind of scaling helps.",
    },
    tradeoff: {
      title: "A bigger machine against more machines",
      gain: {
        label: "You gain",
        items: [
          "Scaling up is quick and needs no change to how the program works",
          "Scaling out has no fixed ceiling and removes a single point of failure",
          "Extra machines let you survive failures with spare capacity",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A big machine has a hard limit, costs more per unit and can still crash",
          "Scaling out needs stateless design, balancing and shared storage",
          "More machines mean more to monitor, deploy and keep consistent",
        ],
      },
    },
    pitfalls: [
      "Adding application replicas while a single database stays saturated, so the extra copies just queue behind it.",
      "Keeping user sessions in one machine's memory, then wondering why users are logged out when a different replica answers.",
      "Scaling on a guess instead of measuring CPU, memory, network and storage to find the real limit.",
    ],
    remember: [
      "Measure the bottleneck before buying capacity.",
      "Scale up is simple but capped; scale out needs stateless design.",
      "Keep headroom for bursts and failures.",
      "Extra servers do not help if the database is the limit.",
    ],
    interview: [
      "Compare the simplicity ceiling of scaling up with the coordination cost of scaling out, and say which you would do first for this system.",
      "Name what must change before the service can be scaled out, such as moving sessions into shared storage.",
    ],
    quizzes: [
      {
        question: "Three API replicas are added, but response times do not improve. The database CPU is at 95 per cent. What is the likely reason?",
        options: [
          "The load balancer cannot send traffic to more than one replica",
          "The database is the bottleneck, so extra copies only queue",
          "Replicas always run slower than a single larger machine does",
          "The extra replicas are using too little memory to be useful",
        ],
        answer: 1,
        why: "Capacity is limited by the slowest stage. With the database saturated, additional API machines only create more requests waiting for it.",
      },
      {
        question: "Users keep being logged out because their session lives in one server's memory and the next request reaches a different server. What is the fix?",
        options: [
          "Buy a bigger server so only one handles all requests",
          "Ask users to log in again every few minutes",
          "Remove the login feature so no session is needed",
          "Store sessions in shared storage that every server reads",
        ],
        answer: 3,
        why: "Making servers stateless by moving session data to a shared place lets any copy serve any request. Simply buying a bigger server would remove neither the limit nor the single point of failure.",
      },
      {
        question: "A service runs on one large machine. Which risk does scaling out most directly reduce?",
        options: [
          "A single crash taking the whole service offline",
          "Slower disks causing long waits for stored data",
          "Programmers needing to write code in a new language",
          "Users needing a faster internet connection at home",
        ],
        answer: 0,
        why: "With several machines, losing one leaves the others running. A single large machine remains a single point of failure, however powerful it is.",
      },
    ],
  },
  {
    slug: "load-balancing-and-health",
    title: "Load Balancing and Health Checks",
    summary: "Send work only to instances that can safely accept it.",
    intro: [
      "A load balancer sits in front of several copies of a service and decides which copy gets each request. It might go round in turn, pick the copy with the fewest open requests, or prefer copies in the same zone. It also needs to know which copies are fit to use, which is the job of health checks.",
      "There are two different health questions. Readiness asks, \"can this copy accept new work right now?\" Liveness asks, \"is this copy stuck so badly that it should be restarted?\" Mixing them up causes trouble: a copy that is merely busy loading data should be given time, not killed. And a copy that is about to be removed should finish its current work before it goes.",
    ],
    analogy: [
      "A host seating restaurant guests",
      "The host sends each party to an open table, skips a table being cleaned, and notices when a whole section closes. A table is not shut forever because the waiter is busy for a minute; it just receives no new guests until ready.",
    ],
    glossary: [
      ["load balancer", "A component that spreads incoming requests across several copies of a service."],
      ["readiness probe", "A check that tells whether a copy can safely receive new traffic right now."],
      ["liveness probe", "A check that tells whether a copy is stuck and should be restarted."],
      ["connection draining", "Stopping new work to a copy while letting requests already in progress finish."],
    ],
    walkthrough: {
      title: "Follow three instances through a bad afternoon",
      steps: [
        { label: "Instance B starts", text: "B is still loading its database connections, so its readiness check says no. The load balancer sends it nothing, and A and C carry the traffic." },
        { label: "B becomes ready", text: "After thirty seconds B reports ready, passes the check and starts receiving a share of requests." },
        { label: "B freezes", text: "Later B stops responding altogether. Its liveness check fails repeatedly, so the platform restarts it, and it leaves rotation while it is down." },
        { label: "Drain A for maintenance", text: "Before A is shut down for an update, it stops getting new requests but is given time to finish the ones in progress, so no user sees a broken page." },
      ],
    },
    example: {
      title: "Worked example: a health check that lies",
      text: "A service has a health endpoint that always returns 200 OK as soon as the process starts. Its database connection pool is broken, so every real request fails with an error. The load balancer sees a healthy instance and keeps sending traffic to it, so one third of users, the share routed to that instance, get errors while the dashboards say all is well. A better readiness check does a cheap test of the things the instance needs, such as the ability to borrow a database connection. It must stay cheap, though: if every probe runs a heavy query, a hundred instances probing every few seconds can overload the database themselves.",
    },
    tradeoff: {
      title: "How strict should health checks be?",
      gain: {
        label: "You gain",
        items: [
          "Unhealthy copies stop receiving users' requests quickly",
          "Deployments and restarts happen without visible errors",
          "Load is shared so no single copy is overwhelmed",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Strict checks may remove healthy copies during a short blip",
          "Deep checks cost time and can overload the thing they test",
          "Sticky routing can leave some copies busier than others",
        ],
      },
    },
    pitfalls: [
      "Using a shallow 200 response as proof that the whole request path works.",
      "Restarting a copy that is only slow to start because the liveness check is too impatient.",
      "Having every instance run an expensive dependency check, so the checks themselves cause an outage.",
    ],
    remember: [
      "Readiness means \"send me work\"; liveness means \"restart me\".",
      "Drain before removing, so in-flight requests finish.",
      "Health checks must be cheap and honest.",
      "A load balancer is only as good as the signals it receives.",
    ],
    interview: [
      "Discuss algorithms, sticky sessions, zone awareness and graceful draining only as the requirements need them. Name the problem each one solves.",
      "Describe what happens to the requests in flight when an instance is taken out of service.",
    ],
    quizzes: [
      {
        question: "A new instance needs 30 seconds to load its data after starting. What should the platform do during those 30 seconds?",
        options: [
          "Restart it repeatedly until it responds instantly",
          "Send it a full share of traffic so that it warms up",
          "Keep it out of rotation until it reports ready",
          "Remove it permanently since slow starts are a failure",
        ],
        answer: 2,
        why: "An instance that is not ready should receive no traffic, but it is not broken, so it must not be killed. Readiness and liveness exist to tell these cases apart.",
      },
      {
        question: "An instance's health endpoint always answers 200, yet its database link is broken and real requests fail. What is the flaw?",
        options: [
          "The load balancer should not use health checks at all",
          "The check is too shallow to show real work succeeds",
          "The instance should answer 500 even when it works perfectly",
          "Real requests never depend on the database in this design",
        ],
        answer: 1,
        why: "A probe that tests nothing reports health that does not exist. A meaningful readiness check should include a cheap test of what the instance needs to serve real requests.",
      },
      {
        question: "Why drain an instance before shutting it down for an update?",
        options: [
          "So requests already in progress can finish cleanly",
          "So the instance can finish downloading a bigger version",
          "So the load balancer needs fewer health checks afterwards",
          "So users are forced to log in again after the update",
        ],
        answer: 0,
        why: "Draining stops new requests but lets current ones complete, so users do not see errors when an instance leaves. Cutting the instance off immediately would break whatever it was serving.",
      },
    ],
  },
  {
    slug: "caching-layers",
    title: "Caching Without Stale Surprises",
    summary: "Use faster copies while planning expiry, invalidation and misses.",
    intro: [
      "A cache is a small, fast copy of data that is slow or expensive to fetch. Instead of asking the database the same question a thousand times a minute, you ask once, keep the answer nearby, and reuse it. Caches sit in many places — the browser, a CDN near the user, the memory of your service, or a separate cache server such as Redis.",
      "The speed is real, but so is the catch: a copy can go out of date. Every cache therefore needs three decisions written down before it is built — what the key is, how long a copy may live, and what happens when the original changes. Skip those decisions and the cache will one day show a user an old price, a deleted post or someone else's data.",
    ],
    analogy: [
      "The notebook on your desk",
      "You keep your friends' phone numbers in a notebook on your desk because opening the school records office every time would take all afternoon. The notebook is fast. But when a friend changes their number, the notebook keeps the old one until you cross it out — and it never tells you it is wrong.",
    ],
    glossary: [
      ["cache hit", "The answer was found in the fast copy, so the slow source was not touched."],
      ["cache miss", "The answer was not in the copy, so the request had to visit the slow source."],
      ["TTL (time to live)", "How long a cached copy may be used before it must be fetched again."],
      ["invalidation", "Deleting or replacing a cached copy because the original has changed."],
      ["cache stampede", "Many requests missing at the same moment and all rebuilding the same value at once."],
    ],
    walkthrough: {
      title: "Follow one read through a cache",
      steps: [
        { label: "Look in the cache", text: "A learner opens the Java course page. The service builds a key such as `catalogue:java` and asks the cache for it first." },
        { label: "Miss: ask the source", text: "Nothing is there yet, so the service reads the course from the database — the slow, authoritative copy." },
        { label: "Fill with an expiry", text: "It stores the result under that key with a TTL of 60 seconds, then returns it. Every request in the next minute is a hit and never touches the database." },
        { label: "Change: invalidate", text: "When an author edits the course, the write path deletes `catalogue:java`. The next read misses and fetches the new version instead of waiting out the TTL." },
      ],
    },
    example: {
      title: "Worked example: a catalogue read 5,000 times a minute",
      text: "The course catalogue changes a few times a day but is read about 5,000 times a minute. With a 60-second TTL, the database answers about one read per key per minute instead of 5,000. The cost: after an edit, readers may see the old catalogue for up to a minute unless the edit also invalidates the key. And when the key expires, hundreds of requests may miss together — letting one request rebuild it while the rest briefly reuse the old copy stops them all hitting the database at once.",
    },
    tradeoff: {
      title: "What a cache buys, and what it costs",
      gain: {
        label: "You gain",
        items: [
          "Much faster reads for data that is asked for again and again",
          "Far less load on the database, so it survives traffic spikes",
          "Lower cost per request once most reads are hits",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Readers can see old data until the copy expires or is invalidated",
          "A second system to run, size and watch",
          "A sudden flood of misses when the cache is emptied or restarted",
        ],
      },
    },
    artifact: {
      kind: "table",
      head: ["Pattern", "How a write works", "Good when"],
      rows: [
        ["Cache-aside", "Write to the database, then delete the cache key; the next read refills it.", "Reads far outnumber writes — the usual default."],
        ["Write-through", "Write to the cache and the database together, every time.", "Readers must see a fresh value right after a write."],
        ["Write-behind", "Write to the cache now; save to the database a little later.", "Writes are very frequent and losing the last few is acceptable."],
      ],
    },
    pitfalls: [
      "Treating the cache as the source of truth. If a cache restart can lose data for good, it was never a cache.",
      "Changing data in the database without invalidating its cached copy, so users keep seeing the old value until the TTL runs out.",
      "Caching one user's data under a shared key, so one person's account details are served to another.",
    ],
    remember: [
      "A cache is a copy. The database stays the truth.",
      "Decide the key, the TTL and the invalidation rule before you add a cache.",
      "Every write path that changes data must also fix its cached copy.",
      "Plan for the miss: what happens when the cache is empty?",
    ],
    interview: [
      "When you add a cache, say what you are caching, the TTL, and how a write invalidates it — interviewers listen for the invalidation plan.",
      "Name one concrete failure and its fix, such as a stampede on a popular key solved by letting one request refresh while others use the old copy.",
    ],
    quizzes: [
      {
        question: "An author fixes a typo in a course title, but learners still see the old title for a minute. What is the most likely cause?",
        options: [
          "The database did not save the author's change",
          "The cached copy was not invalidated, so it lives until its TTL ends",
          "Browsers cannot display a title that has been edited",
          "The cache server is too small to hold the new title",
        ],
        answer: 1,
        why: "The database has the new title, but the cache still holds the old copy. Without invalidation, that copy keeps being served until its time to live runs out.",
      },
      {
        question: "Which data is the poorest candidate for a shared cache?",
        options: [
          "A list of courses that changes twice a day",
          "Today's top ten questions, rebuilt every hour",
          "One person's balance during a money transfer",
          "The thumbnail images shown on course cards",
        ],
        answer: 2,
        why: "A balance during a transfer must be exactly right at that moment and belongs to one person. A stale or shared copy could show the wrong amount, and being wrong costs far more than the time a cache saves.",
      },
      {
        question: "A popular key expires and 300 requests miss at the same moment. What is a sensible fix?",
        options: [
          "Remove the TTL so that the key never expires",
          "Let one request rebuild it while the rest reuse the old copy",
          "Send all 300 to the database, since it holds the truth",
          "Give every user their own copy of the same value",
        ],
        answer: 1,
        why: "This is a cache stampede. Letting a single request refresh the value while the others reuse the previous copy keeps the database from being hit 300 times at once.",
      },
    ],
  },
  {
    slug: "sql-and-nosql",
    title: "SQL, NoSQL and the Actual Workload",
    summary: "Choose a store from relationships, queries, consistency and scale—not fashion.",
    intro: [
      "A relational (SQL) database keeps data in tables that link to each other, lets you ask flexible questions with joins, and can change several rows in one all-or-nothing transaction. NoSQL is a loose name for other kinds of store: key-value stores that fetch a value by its key, document stores that keep a whole record as one flexible document, and several more. Each is built to make certain jobs easy.",
      "The choice should follow the work, not the trend. Ask which questions the product asks most, whether several facts must change together, and how much data and traffic there will be. A common mistake is to pick a NoSQL store \"because we may become huge\", and then find that the simple questions you actually need, such as totals across customers, are suddenly hard.",
    ],
    analogy: [
      "A ledger and labelled storage bins",
      "A ledger is excellent when entries relate to each other and totals must always agree. Labelled bins make it quick to fetch one known item, but a question that cuts across many bins, such as \"how many red items in total?\", needs extra planning.",
    ],
    glossary: [
      ["relational database", "A store of related tables with constraints, joins and transactions."],
      ["document store", "A store that keeps a related group of fields together as one flexible document."],
      ["key-value store", "A store built to return a value quickly when given one key."],
      ["transaction", "A group of changes that either all succeed or all fail together."],
    ],
    walkthrough: {
      title: "Follow a hotel booking to a choice of stores",
      steps: [
        { label: "List what must be true", text: "A booking must reserve a room, record a payment reference and never be sold twice. Several facts must change together or not at all." },
        { label: "Choose for that job", text: "That need for a transaction and a uniqueness rule points to a relational database as the main store." },
        { label: "Find a second job", text: "Browsing hotel summaries by ID happens thousands of times a minute, and the summaries change rarely. Fetching by one key is exactly what a key-value cache does well." },
        { label: "Keep one truth", text: "The relational database stays the source of truth. The key-value copy is rebuilt from it, so the two stores never argue about who is right." },
      ],
    },
    example: {
      title: "Worked example: two stores for two jobs",
      text: "A booking site has 40,000 hotels and about 2,000 booking attempts a minute at peak. Bookings go into a relational database, where a unique rule on room and night makes double-selling impossible even if two requests race. Property summaries, read perhaps 30,000 times a minute, are kept in a key-value store under keys such as `hotel:1021`. Using both is justified by two different jobs, not by a belief that one is better. If the team had put bookings in a store with no multi-row transactions, they would have to build their own safeguards against double-selling in application code, which is easy to get wrong.",
    },
    tradeoff: {
      title: "Starting point: relational or key-value or document",
      gain: {
        label: "Relational gives",
        items: [
          "Joins and flexible queries over related records",
          "Strong rules, such as uniqueness and links between tables",
          "Transactions across several rows",
        ],
      },
      cost: {
        label: "Key-value or document gives",
        items: [
          "Very fast access when you know the key",
          "A flexible shape for a record that is read and written as a whole",
          "Simpler spreading of data across machines, at the cost of cross-record questions",
        ],
      },
    },
    artifact: {
      kind: "compare",
      title: "Start from the dominant need",
      columns: [
        { label: "Relational", items: ["Related records and joins", "Strong constraints", "Flexible transactional queries"] },
        { label: "Key-value or document", items: ["Known-key access", "Flexible aggregate shape", "Straightforward horizontal partitioning"] },
      ],
    },
    pitfalls: [
      "Selecting NoSQL because the system may become large, without a plan for how data is split and queried.",
      "Using one store for every job, even when two jobs have very different access patterns.",
      "Ignoring how the team will operate and back up the store, which matters as much as its features.",
    ],
    remember: [
      "Start from the queries and guarantees, not from a brand.",
      "A relational database is a strong default when facts must change together.",
      "Key-value and document stores shine when you fetch by known key.",
      "Using two stores needs one clear source of truth.",
    ],
    interview: [
      "Compare two plausible stores against the same workload, naming one query that is easy in each and one that is hard.",
      "State the consistency you need for money or inventory before choosing, and say where a cache or copy could be allowed to be slightly old.",
    ],
    quizzes: [
      {
        question: "A shop must deduct stock and record an order together, and never sell the last item twice. Which need matters most for the store choice?",
        options: [
          "Storing documents in a very flexible shape",
          "Several changes that succeed or fail together",
          "Fetching a value by key as quickly as possible",
          "Spreading data over as many machines as possible",
        ],
        answer: 1,
        why: "Changes that must happen together, plus rules that stop duplicates, are what transactions and constraints provide. Flexible shape, key lookups and wide spreading do not address that need.",
      },
      {
        question: "A team picks a NoSQL store because the product \"might get huge\", then needs a report of total sales by month across all customers. What is the likely problem?",
        options: [
          "NoSQL stores cannot hold numbers or dates at all",
          "Questions across records can be hard to answer",
          "Reports can only be produced by relational databases",
          "Large systems never need reports of any kind",
        ],
        answer: 1,
        why: "Stores shaped for fetching by key can make questions that cut across many records awkward. Choosing from a guess about future size, not from the real queries, led to this.",
      },
      {
        question: "Hotel summaries are read 30,000 times a minute and change twice a day. What is a sensible way to serve them?",
        options: [
          "Move the booking data out of its database as well",
          "Copy each summary under a key in a fast key-value store",
          "Store summaries only in the browser of each user",
          "Recalculate every summary from raw bookings on each view",
        ],
        answer: 1,
        why: "This is a read-heavy, rarely-changing, fetch-by-ID job, which suits a key-value copy. The relational database stays the source of truth and the copy is rebuilt from it.",
      },
    ],
  },
  {
    slug: "indexes-and-query-cost",
    title: "Indexes and Query Cost",
    summary: "Trade extra write work and storage for faster reads.",
    intro: [
      "An index is a helper structure that lets a database find rows without reading the whole table. Most databases keep it as a sorted tree, so finding a value takes a handful of steps, even among millions of rows. A composite index covers several columns in a chosen order, such as class and then due date.",
      "Indexes are not free. Each one takes storage, and every insert, update or delete must also update it, so writes slow down. They also only help queries that match their shape: an index on `(class_id, due_date)` helps a search by class, but not a search by due date alone. A query plan, which most databases can show you, tells whether an index is really used.",
    ],
    analogy: [
      "The index at the back of a textbook",
      "The index lets you jump to a topic without flipping through every page. But somebody must update it whenever the book changes, and an index of topics is no use if you want to find every page printed in blue.",
    ],
    glossary: [
      ["index", "A helper structure that finds matching rows without scanning the whole table."],
      ["composite index", "An index ordered by more than one column, in a specific order."],
      ["selectivity", "How strongly a condition narrows the rows, where very selective means very few matches."],
      ["query plan", "The steps the database chooses to run a query, including whether it uses an index."],
    ],
    walkthrough: {
      title: "Follow one query with and without an index",
      steps: [
        { label: "The query", text: "The app runs `WHERE class_id = 12 ORDER BY due_date` many times a minute on a table of 2 million assignments." },
        { label: "No index", text: "The database has to scan every row to find those for class 12, and then sort them. This takes time that grows with the table." },
        { label: "Add an index", text: "An index on `(class_id, due_date)` lets the database jump straight to class 12, and the rows are already in due-date order, so no sort is needed." },
        { label: "Pay at write time", text: "Each new assignment must now also be placed in the index. A few more microseconds per write is a small price for a much faster read." },
      ],
    },
    example: {
      title: "Worked example: why column order matters",
      text: "Take 2 million assignments across 400 classes, so about 5,000 per class, with due dates spread over a year. The query asks for class 12 in due-date order. An index on `(class_id, due_date)` jumps to the 5,000 rows for class 12 and reads them in order. If the index were `(due_date, class_id)` instead, rows are grouped by date first, so finding class 12 means checking every date, and the sort order is lost. A query filtering only on `due_date` could use the second index but not the first. The same two columns give very different results depending on order, so design the index from the exact query.",
    },
    tradeoff: {
      title: "Faster reads, slower writes",
      gain: {
        label: "You gain",
        items: [
          "Queries that match the index finish in a few steps, not a full scan",
          "Ordered results can come straight from the index, with no sort",
          "A covering index can answer a query without touching the table at all",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Every write must update every index on the table",
          "Indexes use extra disk and memory",
          "Unused indexes add cost and give nothing back",
        ],
      },
    },
    pitfalls: [
      "Indexing every column and slowing writes without improving any important query.",
      "Putting the columns of a composite index in the wrong order for the real query.",
      "Guessing that an index is used without looking at the query plan.",
    ],
    remember: [
      "An index trades slower writes and more storage for faster reads.",
      "Column order in a composite index matters.",
      "Index for your frequent queries, not for every column.",
      "Check the query plan to confirm the index is used.",
    ],
    interview: [
      "Design a composite index for one exact query and explain why the field order matters.",
      "Mention the write cost and ask which queries are frequent enough to deserve an index.",
    ],
    quizzes: [
      {
        question: "A table has an index on `(class_id, due_date)`. Which query can use it most effectively?",
        options: [
          "Finding every assignment due on a given date in any class",
          "Finding assignments by title, with no other condition",
          "Counting all rows in the table, with no condition",
          "Finding class 12's assignments, ordered by due date",
        ],
        answer: 3,
        why: "The index starts with class_id, so it can jump to one class, and its rows are already sorted by due date. A search on date alone, or on a column not in the index, cannot use it that way.",
      },
      {
        question: "A team adds an index to every column of a busy table. What is the most likely effect?",
        options: [
          "All queries get faster and nothing else changes",
          "Writes get slower because each change updates many indexes",
          "The table shrinks since indexes compress the stored data",
          "The database no longer needs a query plan at all",
        ],
        answer: 1,
        why: "Each index must be maintained on every insert, update and delete. Too many indexes slow writes and use storage, with little gain for queries that never use them.",
      },
      {
        question: "A query is slow even though a suitable index exists. What should you check first?",
        options: [
          "Whether the database is allowed to use any indexes",
          "Whether the query plan really uses that index",
          "Whether the table could be renamed to something shorter",
          "Whether every column should now be indexed as well",
        ],
        answer: 1,
        why: "The query plan shows what the database actually does. An index that exists but is not chosen, perhaps because the condition does not match its leading column, cannot help.",
      },
    ],
  },
  {
    slug: "replication-and-failover",
    title: "Replication and Failover",
    summary: "Keep copies for availability and read scale while handling lag honestly.",
    intro: [
      "Replication keeps copies of the same data on more than one machine. A common setup has one leader that accepts writes and replicas that copy every change and can answer reads. If the leader fails, one replica is promoted to take over, which is called failover.",
      "Copying takes time. With synchronous replication, the leader waits for a replica to confirm before saying a write is done, so little is lost in a crash but every write is slower. With asynchronous replication, the leader answers at once, which is faster, but a replica can lag behind and the last few writes can be lost if the leader dies. This is a choice about how much loss and delay you can accept.",
    ],
    analogy: [
      "Duplicate answer sheets in separate rooms",
      "A second copy protects against a spilled drink on the first. But it only helps if changes reach it, and if everybody knows which sheet is the real one. Two sheets with different answers are worse than one.",
    ],
    glossary: [
      ["leader", "The copy that accepts writes and sends changes on to the others."],
      ["replica", "A copy that follows the leader and can serve reads."],
      ["replication lag", "How far behind the leader a replica currently is."],
      ["failover", "Promoting a replica to leader when the old leader fails."],
      ["split-brain", "A fault in which two machines both believe they are the leader and accept conflicting writes."],
    ],
    walkthrough: {
      title: "Follow a leader failure minute by minute",
      steps: [
        { label: "Normal running", text: "Writes go to leader L. Replicas R1 and R2 copy each change, usually within a fraction of a second. Reads of old data can be answered by either." },
        { label: "The leader fails", text: "At 10:00 L stops responding. Monitoring waits a few seconds before declaring it dead, since a short network blip should not trigger failover." },
        { label: "Promote a replica", text: "R1 is the most up to date, so it is promoted to leader. The other replicas are told to follow R1, and it begins accepting writes." },
        { label: "Clients reconnect", text: "Applications are pointed at R1. Any writes L had not yet copied are missing, and old L must not come back as a second leader." },
      ],
    },
    example: {
      title: "Worked example: what asynchronous replication can lose",
      text: "A leader handles 500 writes per second and replicates asynchronously with an average lag of 40 ms. When it crashes, about 40 ms of writes, roughly 20 of them, may exist only on the dead machine. The replicas are consistent with each other but missing those last writes. A customer who saw \"order confirmed\" a moment before the crash might find no order afterwards. Synchronous replication to one replica would close that gap, but each write would then wait for a round trip to the replica, perhaps adding a few milliseconds. For payments that trade is often worth it; for a view counter it is not.",
    },
    tradeoff: {
      title: "Synchronous against asynchronous copying",
      gain: {
        label: "You gain",
        items: [
          "Synchronous copying loses almost nothing when a leader fails",
          "Asynchronous copying keeps writes fast",
          "Replicas let reads be spread over several machines and survive a failure",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Synchronous writes wait for the replica, and fail or stall if it is down",
          "Asynchronous copies can lag, so a read may be out of date",
          "Failover needs careful detection so two leaders never exist at once",
        ],
      },
    },
    pitfalls: [
      "Calling replicas backups. A bad delete or a mistake by an operator is copied to every replica too.",
      "Reading from a replica straight after a write and being surprised when the new data is not there yet.",
      "Failing over on a short network blip and ending up with two leaders both accepting writes.",
    ],
    remember: [
      "Replicas protect against machine failure, not against mistakes.",
      "Asynchronous is fast but can lose the latest writes.",
      "Replicas can lag, so reads can be slightly old.",
      "Failover must make sure that only one leader exists.",
    ],
    interview: [
      "Describe a leader failure minute by minute, including detection, promotion, client reconnection and what data might be lost.",
      "State the replication mode you chose in terms of the data loss and delay the product can accept.",
    ],
    quizzes: [
      {
        question: "A user updates their profile, then immediately reloads and sees the old values. The read was served by a replica. What explains it?",
        options: [
          "The leader refused to save the change at all",
          "The replica had not yet received the latest change",
          "The browser has converted the data into another format",
          "Replicas never contain any data from the leader",
        ],
        answer: 1,
        why: "Replicas copy changes after the leader writes them, so there is a short window where they are behind. Reading your own recent write may need the leader or a lag check.",
      },
      {
        question: "An operator accidentally deletes a table on the leader. Why do replicas not protect the data?",
        options: [
          "Replicas only store a very small part of the data",
          "Replicas are not allowed to hold any real records",
          "The delete is copied to the replicas, which then lose it too",
          "Replicas can be restored only by the user who owns them",
        ],
        answer: 2,
        why: "Replication copies every change faithfully, including mistakes. Recovering from a bad delete needs separate backups or point-in-time recovery.",
      },
      {
        question: "A product cannot afford to lose a confirmed payment when a leader crashes. Which choice best fits?",
        options: [
          "Copy synchronously to at least one replica before confirming",
          "Copy asynchronously so the confirmation is as fast as possible",
          "Keep one single machine with no replicas at all",
          "Copy only once a night, when traffic is at its lowest",
        ],
        answer: 0,
        why: "Waiting for a replica to confirm means the write exists in two places before the customer is told. The cost is a little extra delay, which is acceptable for payments.",
      },
    ],
  },
  {
    slug: "partitioning-and-hot-keys",
    title: "Partitioning, Sharding and Hot Keys",
    summary: "Divide data and traffic without concentrating the busiest work.",
    intro: [
      "Partitioning, also called sharding, splits one large dataset across several machines so that each holds only a part. A partition key, such as user ID, decides which part each record belongs to. You can assign by hash, which spreads records evenly, or by range, such as alphabetical or by date, which keeps neighbours together.",
      "The choice of key decides everything. A good key spreads both data and traffic evenly, and keeps the common query on one machine. A bad one sends most of the load to a single partition, called a hot spot or hot key, which then limits the whole system however many machines you add. Questions that need data from several partitions get slower and harder.",
    ],
    analogy: [
      "Checkout lines split by surname",
      "Splitting shoppers into lines by the first letter of their surname spreads people out. But if a school trip arrives and everyone's name starts with S, that one line is swamped while the others are empty. The split looked fair, but the real crowd was not.",
    ],
    glossary: [
      ["partition key", "The field whose value decides which partition a record is stored in."],
      ["shard", "One partition of the data, usually living on its own machine or group of machines."],
      ["hot key", "A key that receives far more traffic than the average, overloading its partition."],
      ["rebalancing", "Moving data between partitions when machines are added or the load shifts."],
    ],
    walkthrough: {
      title: "Follow a messaging app's data across four shards",
      steps: [
        { label: "Choose the key", text: "Messages are always read by conversation, so the key is `conversation_id`. Each conversation lives wholly on one shard." },
        { label: "Route a write", text: "A message arrives. The router hashes its conversation ID and gets shard 2. It writes there only, and no other shard is involved." },
        { label: "Read a conversation", text: "Opening a chat reads from shard 2 alone, which is fast. The common query never crosses shard boundaries." },
        { label: "Meet a hot key", text: "One conversation turns into a huge public group with thousands of messages per second. Its shard struggles even though the others are quiet." },
      ],
    },
    example: {
      title: "Worked example: choosing a key for 100 million orders",
      text: "Orders arrive at about 3,000 per second across 8 shards. Partition by `customer_id` with a hash: records spread evenly, and \"show my orders\" hits one shard. Partition by order date range instead: all of today's traffic lands on one shard, the newest, while old shards sit idle. That is a time-based hot spot. Now a flash sale gives one seller 40 per cent of all orders. If the key were `seller_id`, one shard would take 40 per cent of the load, so hashing by customer is safer. The price is that \"all orders for this seller\" must now ask every shard and combine the answers.",
    },
    tradeoff: {
      title: "Splitting data buys scale and costs simplicity",
      gain: {
        label: "You gain",
        items: [
          "More total storage and write capacity than one machine allows",
          "Queries that stay on a single shard remain fast",
          "A failure affects only one part of the data",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Questions across several shards are slower and more complex",
          "A poor key creates hot spots that more machines cannot fix",
          "Moving data when shards are added needs careful, safe rebalancing",
        ],
      },
    },
    pitfalls: [
      "Partitioning by a value that becomes a celebrity or a time-based hot spot.",
      "Forgetting that joins and totals across partitions are now expensive.",
      "Using automatic counters as keys and assuming they stay unique when each shard counts on its own.",
    ],
    remember: [
      "The partition key decides both balance and which queries are cheap.",
      "Hash spreads evenly; range keeps neighbours together but risks hot spots.",
      "Look for hot keys by studying real traffic, not only record counts.",
      "Cross-shard questions are the price of partitioning.",
    ],
    interview: [
      "Use an estimate of how traffic is distributed to compare hash, range and tenant-aware partitioning for the same workload.",
      "Say how you would find and treat a hot key, and which common query is no longer cheap.",
    ],
    quizzes: [
      {
        question: "An orders table is partitioned by order date range. What problem is most likely?",
        options: [
          "Old orders can never be read again",
          "The newest partition takes nearly all the write traffic",
          "Every query now needs to visit every partition",
          "The partitions will all hold exactly equal amounts of data",
        ],
        answer: 1,
        why: "New orders always carry the latest date, so they all land in one partition while the others sit idle. Time-based keys commonly create this kind of hot spot.",
      },
      {
        question: "One user becomes extremely popular and their shard is overloaded, while three other shards are nearly idle. What does this show?",
        options: [
          "Hashing a key guarantees that traffic spreads evenly",
          "The idle shards should be removed to save money",
          "A hot key can overload a single shard on its own",
          "The popular user must have done something wrong",
        ],
        answer: 2,
        why: "Even spread of data does not mean even spread of traffic. A very busy single key still lands on one shard, and adding other shards does not take its load.",
      },
      {
        question: "Data is partitioned by `customer_id`. Which request is now the most expensive?",
        options: [
          "Showing one customer's orders",
          "Adding a new order for a customer",
          "Listing every order for one seller",
          "Updating a customer's delivery address",
        ],
        answer: 2,
        why: "Requests tied to one customer reach one shard. Gathering all orders for a seller means asking every shard and merging the answers, which is slower and more complex.",
      },
    ],
  },
  {
    slug: "consistent-hashing",
    title: "Consistent Hashing and Rebalancing",
    summary: "Move only a limited share of keys when cache or storage nodes change.",
    intro: [
      "To decide which of several servers holds a key, a simple method is to hash the key to a number and take the remainder after dividing by the number of servers. It works until the number of servers changes. Then almost every key maps to a different server, so a cache is suddenly empty and a database must move most of its data.",
      "Consistent hashing avoids this. Servers and keys are both placed on an imaginary circle, a ring, using a hash. A key belongs to the first server found going round the ring from its position. Adding or removing a server then only affects the keys next to it. Giving each server many positions, called virtual nodes, smooths out uneven shares.",
    ],
    analogy: [
      "Adding a locker to a circular cloakroom",
      "If every ticket is assigned by dividing by the number of lockers, adding one locker means nearly every coat must move. If lockers sit around a circle and each coat goes to the next locker clockwise, a new locker only takes the coats between it and its neighbour.",
    ],
    glossary: [
      ["hash ring", "An imaginary circle of positions used to assign keys to nodes."],
      ["virtual node", "One of several ring positions given to a single physical server, to even out its share."],
      ["rebalancing", "Moving ownership of data after servers join, leave or change capacity."],
      ["hot key", "A single key whose traffic is far above the average."],
    ],
    walkthrough: {
      title: "Follow a cache node being added",
      steps: [
        { label: "Place everything", text: "Cache nodes A, B and C are hashed onto the ring. Each key is hashed too, and belongs to the first node clockwise from its position." },
        { label: "Look up a key", text: "To find `user:77`, hash it, find its spot on the ring, and walk clockwise to the first node. Any client with the same ring gets the same answer." },
        { label: "Add node D", text: "D lands between B and C on the ring. Only keys that sit between B and D, which used to go to C, now go to D." },
        { label: "Everything else stays", text: "Keys owned by A and B keep their owners, and most of C's keys stay too. Only a slice of the cache is cold, not all of it." },
      ],
    },
    example: {
      title: "Worked example: 10 nodes become 11",
      text: "With 10 cache nodes and `hash(key) % 10`, adding an 11th node changes the remainder for about 10 out of every 11 keys, so roughly 91 per cent of cached entries now point to a different node and miss at once. The database behind them takes a sudden flood. On a ring with 10 nodes, the new node takes over about one eleventh of the keys, roughly 9 per cent, and the rest keep their owners. Real clusters often use 100 or more virtual nodes per server, which makes each server's share closer to equal. Even so, a single hot key still lands on one node, which hashing alone cannot fix.",
    },
    tradeoff: {
      title: "Smaller moves in exchange for more machinery",
      gain: {
        label: "You gain",
        items: [
          "Adding or removing a node moves only a small fraction of keys",
          "Caches stay mostly warm during scaling and failures",
          "Virtual nodes can give stronger machines a larger share",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Clients or a router must know the current ring",
          "Balance is statistical, not perfect, and needs enough virtual nodes",
          "It does nothing for a hot key that overloads one node",
        ],
      },
    },
    pitfalls: [
      "Treating the hash ring as a guarantee of perfect balance without measuring real key popularity.",
      "Using too few virtual nodes, so one server randomly owns a much bigger share.",
      "Letting different clients hold different versions of the ring, so they disagree on where a key lives.",
    ],
    remember: [
      "Simple modulo hashing reshuffles almost everything when the node count changes.",
      "On a ring, a change affects only neighbouring ranges.",
      "Virtual nodes even out the load.",
      "Hashing spreads keys, not popularity.",
    ],
    interview: [
      "Compare the number of keys that move when one node is added under modulo hashing and under consistent hashing, with real numbers.",
      "Mention virtual nodes, replication to the next nodes on the ring, and how clients learn about ring changes.",
    ],
    quizzes: [
      {
        question: "A cache of 10 nodes uses `hash(key) % 10`. A new node is added and the formula becomes `% 11`. What happens?",
        options: [
          "Only a small slice of keys changes node",
          "No key changes node, since hashes stay the same",
          "Most keys move to a different node",
          "Every key is stored again on all of the nodes",
        ],
        answer: 2,
        why: "The remainder after dividing by 11 differs from the remainder after dividing by 10 for most keys, so most keys now point elsewhere and the cache looks empty. Consistent hashing avoids this.",
      },
      {
        question: "What is the purpose of virtual nodes on a hash ring?",
        options: [
          "To let a server hold more data than its disk allows",
          "To make the ring faster by removing the need for hashing",
          "To even out each server's share of the ring",
          "To copy every key onto each server in the ring",
        ],
        answer: 2,
        why: "A few random points on a ring can leave one server with a much larger arc. Many virtual positions per server average this out and let stronger machines take more.",
      },
      {
        question: "One celebrity's profile key gets 50 per cent of all cache traffic on a well-balanced ring. What does consistent hashing do for this?",
        options: [
          "It splits that one key evenly across every node",
          "It moves the key to a new node every minute",
          "Nothing, as that key still lands on one node",
          "It deletes the key until traffic becomes lower",
        ],
        answer: 2,
        why: "A ring spreads different keys across nodes, but one key always maps to one place. A very popular key needs another remedy, such as copies of it on several nodes or a local cache.",
      },
    ],
  },
  {
    slug: "consistency-and-cap", title: "Consistency and Network Partitions", summary: "Decide what users may observe when copies cannot communicate.",
    ...legacyDetails("consistency-and-cap"),
    analogy: ["Two ticket counters after the phone line breaks", "Both counters can keep selling and risk duplicate seats, or one can stop until it can confirm availability. The broken link forces a choice."],
    idea: "During a network partition, a distributed service cannot guarantee both every request succeeds and every response reflects one latest order. Real designs choose per operation and often offer session guarantees or conflict resolution.",
    flow: ["write accepted", "copies diverge", "reconcile or reject"], best: "State the consistency users require for each operation, especially money, ownership and inventory.", check: "Check read-after-write, monotonic reads, conflict detection and partition behaviour.", pitfall: "Using CAP as a database ranking or claiming a system is simply consistent at all times.", interview: "Tell a user-visible partition story rather than only naming C, A and P.",
  },
  {
    slug: "transactions-and-concurrency", title: "Transactions and Double-Booking", summary: "Protect multi-step invariants when many requests race.",
    ...legacyDetails("transactions-and-concurrency"),
    analogy: ["Reserve a changing room before walking to it", "Two shoppers seeing one free room cannot both claim it. A single guarded update must decide the winner."],
    idea: "Transactions keep related changes atomic. Isolation controls which concurrent effects can be observed. Optimistic locking checks a version at write time; pessimistic locking reserves access earlier. Constraints are the final guard.",
    flow: ["read version", "conditional update", "commit or retry"], best: "Put the invariant in a database constraint or atomic conditional write, not only application code.", check: "Check races, deadlocks, retry safety and transaction boundaries.", pitfall: "Reading availability and writing a booking as separate unguarded operations.", interview: "Draw two concurrent requests and point to the exact operation that permits only one winner.",
    lab: "ticket-booking",
  },
  {
    slug: "leader-election-and-leases", title: "Leader Election and Leases", summary: "Choose one temporary coordinator without pretending it can never lose authority.",
    analogy: ["A speaking token in a debate", "Only the person holding the unexpired token may announce the next decision. If time runs out, the group can issue a newer token to somebody else."],
    idea: "Some jobs need one active coordinator: scheduling work, assigning sequence numbers or managing a partition. Election chooses a leader; a time-limited lease makes leadership expire. A fencing token lets storage reject commands from an older leader that wakes up late.",
    flow: ["candidates request leadership", "quorum grants a lease", "storage checks fencing token"],
    best: "Treat leadership as a renewable lease and fence every state-changing command with a monotonically increasing token.",
    check: "Check clock assumptions, quorum loss, slow leaders, lease renewal, duplicate work and recovery time.",
    pitfall: "Assuming a timed-out leader has stopped; a paused process may resume and write stale decisions.",
    interview: "Walk through a leader pause, a replacement election and the old leader's rejected write.",
    example: "Scheduler A holds fencing token 41, pauses, and loses its lease. Scheduler B receives token 42. When A resumes, the job store rejects token 41, so two schedulers cannot both commit ownership.",
    glossary: [["leader", "The one process temporarily allowed to coordinate a job."], ["lease", "Leadership permission that expires unless renewed."], ["quorum", "Enough independent members to make a decision safely."], ["fencing token", "An increasing number that makes stale leaders' writes rejectable."]],
  },
  {
    slug: "queues-streams-and-backpressure", title: "Queues, Streams and Backpressure", summary: "Decouple producers from slower work without hiding overload forever.",
    ...legacyDetails("queues-streams-and-backpressure"),
    analogy: ["A tray between kitchen and waiters", "The tray absorbs a brief rush, but if dishes arrive faster forever, it fills. Someone must slow orders, add workers or reject work."],
    idea: "Queues buffer and distribute work; streams retain an ordered record for multiple consumers. Consumers acknowledge work. At-least-once delivery means handlers must tolerate duplicates. Backpressure keeps backlog bounded.",
    flow: ["producer publishes", "broker stores", "consumer acknowledges"], best: "Define delivery semantics, idempotent handling and a maximum useful backlog age.", check: "Check lag, poison messages, retries, ordering and overload policy.", pitfall: "Calling a queue infinitely scalable and ignoring stale work piling up.", interview: "Choose sync or async from the user's need for an immediate result, then explain failure recovery.",
  },
  {
    slug: "rate-limits-retries-and-circuits", title: "Rate Limits, Retries and Circuit Breakers", summary: "Keep one struggling dependency from becoming a system-wide failure.",
    ...legacyDetails("rate-limits-retries-and-circuits"),
    analogy: ["A clinic with appointments and an emergency stop", "Appointments smooth arrivals. Repeatedly sending everyone to a closed room makes the hallway worse; pause and try later."],
    idea: "Rate limits enforce fair budgets. Timeouts bound waiting. Retries need exponential backoff, jitter and a budget. A circuit breaker temporarily stops calls to a failing dependency so it can recover.",
    flow: ["admission limit", "bounded attempt", "backoff or fail fast"], best: "Combine timeouts, capped retries with jitter, and an overall deadline.", check: "Check retry amplification, per-tenant fairness and degraded responses.", pitfall: "Retrying every failure immediately at every layer.", interview: "Calculate how three retries across three layers can magnify one failed request.",
  },
  {
    slug: "polling-websockets-and-sse", title: "Polling, Long Polling, WebSockets and SSE", summary: "Choose how a client learns that something changed without wasting work or hiding reconnects.",
    analogy: ["Check the noticeboard, wait at reception or stay on a call", "You can revisit a noticeboard, ask reception to call when news arrives, or keep a conversation open. Each costs a different amount of waiting and connection state."],
    idea: "Polling repeats requests on a schedule. Long polling holds one request until data or a timeout. Server-Sent Events keep a one-way server-to-browser stream. WebSockets keep a two-way message channel. None removes the need for authentication, heartbeats, ordering and reconnect logic.",
    flow: ["client establishes update method", "server publishes a change", "client resumes after disconnect"],
    best: "Use the simplest method that meets update frequency and direction: ordinary polling is often enough for infrequent changes.",
    check: "Check idle connection limits, fan-out, missed-event recovery, backoff, message order and mobile network changes.",
    pitfall: "Choosing WebSockets for a page that refreshes once a minute and then operating millions of idle connections.",
    interview: "Compare all four methods for a dashboard, notifications and two-way chat.",
    example: "A job-status page can poll every five seconds. A news ticker can use SSE because updates flow from server to browser. Chat uses a two-way WebSocket, plus a last-seen message ID so reconnecting devices fill gaps.",
    glossary: [["polling", "The client repeatedly asks whether anything changed."], ["long polling", "The server holds a request until it has an update or a timeout."], ["SSE", "A browser-friendly, one-way stream from server to client."], ["WebSocket", "A long-lived, two-way message channel."]],
  },
  {
    slug: "object-storage-and-cdns", title: "Files, Object Storage and CDNs", summary: "Store large immutable objects cheaply and deliver them near users.",
    ...legacyDetails("object-storage-and-cdns"),
    analogy: ["Warehouse stock with nearby display shelves", "The warehouse keeps the durable item; nearby shelves serve popular items quickly and are refilled when empty."],
    idea: "Keep file bytes in object storage and metadata in a queryable database. Use signed upload URLs to avoid routing every byte through application servers. CDNs cache objects at edge locations.",
    flow: ["signed upload", "object storage", "CDN delivery"], best: "Separate blob bytes from metadata and authorise access with short-lived signed URLs.", check: "Check content type, size, malware scanning, deletion and cache invalidation.", pitfall: "Storing large file bytes directly in a frequently queried relational table.", interview: "Trace upload and download paths, including access control and interrupted transfers.",
  },
  {
    slug: "safe-configuration-and-deployment", title: "Safe Configuration and Deployment", summary: "Release a tested, immutable artifact gradually and make rollback a designed action.",
    analogy: ["Serve one table before the whole banquet", "A cook tries a new dish at one table, watches for complaints and keeps the previous dish ready. A bad recipe is stopped before every guest receives it."],
    idea: "Build one immutable artifact, test it, sign it, and promote the same bytes between environments. Separate configuration from the artifact, validate config before activation, and expose a release first to a canary slice. Automated health gates pause or roll back a harmful change.",
    flow: ["build and verify artifact", "canary with guarded config", "promote or roll back"],
    best: "Promote the same immutable artifact gradually, with automatic rollback based on user-visible health signals.",
    check: "Check schema compatibility, feature-flag ownership, secret handling, config validation, rollback time and mixed-version behaviour.",
    pitfall: "Rebuilding different binaries per environment or changing database assumptions before old application versions stop running.",
    interview: "Compare rolling, blue-green and canary releases, then design a safe database-compatible sequence.",
    lab: "safe-deployment",
    example: "Version 18 is deployed to 1% of instances while version 17 remains active. The release controller compares error rate and p95 latency. A regression crosses the threshold, so traffic returns to version 17 without waiting for a manual repair.",
    glossary: [["immutable artifact", "One build whose bytes do not change between environments."], ["canary", "A small first audience used to detect harm before broad release."], ["blue-green", "Two complete environments where traffic can switch between old and new."], ["feature flag", "A controlled switch that separates code deployment from feature exposure."]],
  },
  {
    slug: "peer-to-peer-systems", title: "Peer-to-Peer Systems", summary: "Let participants exchange data directly while planning discovery, unreachable devices and untrusted peers.",
    analogy: ["Classmates share missing notes with one another", "Instead of asking one teacher to photocopy every page, classmates trade the pages they already have. They still need a class list, a way to find reachable classmates and checks against altered notes."],
    idea: "In a peer-to-peer system, participants can both request and provide data. A small discovery service may introduce peers, but bulk transfer can happen directly. This reduces central bandwidth and can survive one peer leaving, while adding hard problems: home routers block incoming connections, peers disappear, upload speeds differ and every received byte is untrusted.",
    flow: ["peer discovers candidates", "reachable peers exchange verified chunks", "missing data retries elsewhere"],
    best: "Use peers for large, shareable content when central bandwidth is costly, but retain a trustworthy discovery and integrity path.",
    check: "Check NAT traversal, offline peers, rare chunks, duplicate transfer, bandwidth fairness, encryption, identity and malicious content.",
    pitfall: "Assuming every device accepts inbound connections or trusting a chunk merely because several peers offered it.",
    interview: "Compare central client-server delivery with peer-assisted delivery, then explain bootstrap, failure and content verification.",
    example: "A device asks a discovery service for peers holding chunks of a public software image. It downloads different chunks in parallel and verifies each against a trusted manifest hash. If one home network cannot accept a direct connection, a relay or the central origin supplies that chunk.",
    glossary: [["peer", "A participant that can both request and provide data."], ["discovery", "The bootstrap step that helps peers find possible partners."], ["NAT traversal", "Techniques for connecting devices hidden behind home or office routers."], ["content hash", "A value used to verify that received bytes match the trusted original."], ["relay", "A server that forwards traffic when two peers cannot connect directly."]],
  },
  {
    slug: "batch-processing-and-mapreduce", title: "Batch Processing and MapReduce", summary: "Process a large, bounded dataset by splitting independent work and combining results.",
    analogy: ["Count votes by table, then add the subtotals", "Each table counts its own pile in parallel. A coordinator combines small subtotals instead of one person reading every ballot."],
    idea: "Batch processing handles a finite input such as yesterday's logs. A map stage turns independent records into intermediate key-value results; shuffle groups equal keys; reduce combines each group. Checkpoints and retryable tasks let a large job recover without starting over.",
    flow: ["read bounded input", "map and group by key", "reduce and publish output"],
    best: "Use batch work when results can wait and the input can be divided into deterministic, retryable pieces.",
    check: "Check skewed keys, duplicate retries, checkpoint cost, late input, output atomicity and job deadline.",
    pitfall: "Using an hourly batch job for a fraud decision that must happen before a transaction completes.",
    interview: "Explain which calculations are independent, what key causes the shuffle and how a failed worker retries safely.",
    example: "To count daily searches per query, each mapper emits `(query, 1)`. The shuffle groups equal queries. Reducers sum counts, write a versioned result, then one pointer makes the complete version visible.",
    glossary: [["batch", "A finite group of records processed as one job."], ["map", "Transform one input record into one or more intermediate records."], ["shuffle", "Move intermediate records so equal keys meet."], ["reduce", "Combine all intermediate values for one key."]],
  },
  {
    slug: "search-and-autocomplete", title: "Search, Indexing and Autocomplete", summary: "Build a read-optimised view for text lookup and ranked suggestions.",
    ...legacyDetails("search-and-autocomplete"),
    analogy: ["A library catalogue beside the shelves", "The catalogue contains searchable clues about books. It can be rebuilt from the shelves, but it must receive updates to stay useful."],
    idea: "A search index tokenises fields into an inverted map, then filters and ranks matches. Autocomplete needs prefix or n-gram structures and tight latency. The source database remains authoritative.",
    flow: ["change event", "search index", "ranked query"], best: "Treat search as a derived read model with an explicit indexing-lag promise.", check: "Check relevance, freshness, typo handling, access filters and zero-result queries.", pitfall: "Using a transactional database scan for every full-text query at scale.", interview: "Separate candidate retrieval from ranking and describe how updates reach the index.",
  },
  {
    slug: "observability-slos-and-security", title: "Observability, SLOs and Safe Failure", summary: "Know what broke, protect data and practise recovery before an incident.",
    ...legacyDetails("observability-slos-and-security"),
    analogy: ["A car dashboard plus a seat belt", "Gauges explain what the car is doing; alerts signal danger; the seat belt limits damage. None replaces careful driving."],
    idea: "Metrics show trends, logs explain events and traces connect one request across services. Service-level objectives turn user promises into thresholds. Least privilege, encryption, audit trails, backups and tested recovery reduce harm.",
    flow: ["instrument request", "alert on symptom", "diagnose and recover"], best: "Measure user-visible symptoms and tie alerts to an owned response playbook.", check: "Check cardinality, sensitive data in logs, backup restore tests and dependency objectives.", pitfall: "Alerting on every internal metric until operators ignore the noise.", interview: "Finish a design with dashboards, trace IDs, data protection and one rehearsed failure scenario.",
  },
];
