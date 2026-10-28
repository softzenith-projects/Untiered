import type { ChapterSource } from "@/content/courses/system-design/lesson";

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
    slug: "consistency-and-cap",
    title: "Consistency and Network Partitions",
    summary: "Decide what users may observe when copies cannot communicate.",
    intro: [
      "When data is kept in more than one place, the copies must agree. Consistency describes how closely they agree and how soon. Strong consistency means a read always sees the latest completed write. Eventual consistency means that copies may differ for a while but will agree if no new writes arrive. Sitting between them are practical promises, such as \"you always see your own latest change\".",
      "The hard moment is a network partition, when two groups of machines are both running but cannot talk to each other. The CAP idea says that during such a partition a service must choose: refuse some requests to stay correct, or answer all requests and risk disagreeing copies. The choice is not made once for the whole product. It is made for each operation, depending on what an error would cost.",
    ],
    analogy: [
      "Two ticket counters after the phone line breaks",
      "Two counters sell seats for the same show and normally phone each other after each sale. When the line breaks, they can both keep selling and risk selling one seat twice, or one can stop until it can confirm. Either way, the broken line forces a choice.",
    ],
    glossary: [
      ["consistency", "How closely different copies of the same data agree, and how quickly."],
      ["eventual consistency", "A promise that copies will agree after a while if no new changes arrive."],
      ["network partition", "A fault in which groups of working machines cannot communicate with each other."],
      ["read-after-write", "A promise that after you save a change, your own next read shows it."],
      ["conflict", "Two changes made to the same data on different copies that cannot both be applied as they stand."],
    ],
    walkthrough: {
      title: "Follow a seat sale during a partition",
      steps: [
        { label: "Normal day", text: "Counter A and counter B both sell seats for a show and tell each other about every sale. Both always know which seats are gone." },
        { label: "The link breaks", text: "The connection between A and B is cut. Both are working and customers are queueing, but neither can see the other's sales." },
        { label: "Choice one: keep selling", text: "If both keep selling, a customer at each counter may be sold seat 14. The service stays available but two copies disagree." },
        { label: "Choice two: pause", text: "If B refuses sales until the link returns, no seat is sold twice, but B's customers wait or are turned away. The service stays correct but not available at B." },
      ],
    },
    example: {
      title: "Worked example: different promises for different actions",
      text: "A shopping app has three operations. Showing the product list can be eventually consistent: if a price is a few seconds old, nobody is harmed, so the app stays available during a partition. Updating a user's profile should offer read-after-write, so people see their own change straight away, even if others see it a moment later. Taking payment or reserving the last item must not be wrong, so during a partition it is better to show \"try again shortly\" than to risk charging twice or overselling. One product, three different choices, each tied to what an error would cost.",
    },
    tradeoff: {
      title: "Correct answers against always answering",
      gain: {
        label: "Staying consistent gives",
        items: [
          "Everyone sees the same latest data",
          "No double sales or conflicting updates",
          "Simple reasoning for the people building the product",
        ],
      },
      cost: {
        label: "Staying available gives",
        items: [
          "Requests are answered even when machines cannot reach each other",
          "Lower delay, because no waiting for far-away copies",
          "But copies may differ, and conflicts must be detected and resolved later",
        ],
      },
    },
    pitfalls: [
      "Using CAP as a ranking of databases, or claiming a system is simply consistent at all times.",
      "Choosing one setting for the whole product when money and ownership need different guarantees from a news feed.",
      "Allowing conflicting writes with no plan to detect or resolve them afterwards.",
    ],
    remember: [
      "A partition forces a choice between answering and being sure.",
      "Choose per operation, by the cost of being wrong.",
      "Money, ownership and stock lean towards correctness.",
      "Feeds, counts and lists can often be slightly old.",
    ],
    interview: [
      "Tell a user-visible partition story, such as two counters selling one seat, instead of just naming C, A and P.",
      "Say which operations you would protect with strong consistency, which you would relax, and how conflicts are resolved.",
    ],
    quizzes: [
      {
        question: "During a partition, a bank app must show balances and also move money. Which approach is most sensible?",
        options: [
          "Treat both exactly the same, whichever way it goes",
          "Allow transfers on any copy so that nobody is refused",
          "Refuse all balance views until the partition heals",
          "Be strict for transfers and relax for balance views",
        ],
        answer: 3,
        why: "A wrong transfer is expensive, while a slightly old balance is merely inconvenient and can carry a note. Choosing per operation protects what matters most.",
      },
      {
        question: "Two copies of a document are edited at the same time during a partition. When the link returns, they differ. What is this called?",
        options: [
          "A conflict, to be detected and resolved",
          "A cache hit, which the system always prefers",
          "A shard, which is a normal split of data",
          "A health check, which compares the two copies",
        ],
        answer: 0,
        why: "Two changes to the same data made without seeing each other conflict. The system needs a rule, such as the latest edit wins or a merge, or must ask a person.",
      },
      {
        question: "A user posts a comment, reloads, and it is missing. A minute later it appears. What was missing?",
        options: [
          "Durability, because the comment was lost and restored",
          "Read-after-write, since they missed their own edit",
          "Availability, since the whole site was down for a minute",
          "Throughput, since too few comments were handled at once",
        ],
        answer: 1,
        why: "The change was saved but a copy that had not yet received it answered the read. Read-after-write is the promise that you see your own changes straight away.",
      },
    ],
  },
  {
    slug: "transactions-and-concurrency",
    title: "Transactions and Double-Booking",
    summary: "Protect multi-step invariants when many requests race.",
    intro: [
      "A transaction groups several changes so that they succeed or fail as one unit. If you move money out of one account and into another, either both steps happen or neither does. Isolation decides what one transaction can see of another's unfinished work. Together they let many users work on the same data at once without corrupting it.",
      "Races appear when two requests read the same state and both act on it. Two shoppers see one free seat, both click Book, and both bookings are saved. The fix is to make the decision in one guarded step. Optimistic locking checks a version number when writing and rejects the loser. Pessimistic locking reserves the row first. A uniqueness constraint in the database is the last line of defence.",
    ],
    analogy: [
      "Reserve a changing room before walking to it",
      "Two shoppers see the same free changing room and both walk towards it. One of them must lose. The safest shop has a single attendant who hands out the key, so exactly one person can be given the room, however the shoppers arrive.",
    ],
    glossary: [
      ["transaction", "A group of changes that all succeed or all fail together."],
      ["isolation", "The rules that decide what one running transaction can see of another's work."],
      ["optimistic locking", "Checking at write time that the data has not changed since it was read, and failing the write if it has."],
      ["pessimistic locking", "Reserving the data before changing it so others must wait."],
      ["constraint", "A rule enforced by the database itself, such as a value that must be unique."],
    ],
    walkthrough: {
      title: "Follow two people booking seat 14",
      steps: [
        { label: "Both read", text: "Asha and Ben both open the page. The seat shows as free to each of them, with version 7 of the seat record." },
        { label: "Both try to write", text: "Each presses Book. Both requests send an update that says: mark seat 14 as booked, but only if its version is still 7." },
        { label: "One winner", text: "The database applies Asha's update first and moves the version to 8. Ben's condition, version 7, is now false, so his update changes zero rows." },
        { label: "Handle the loser", text: "The application sees that zero rows changed and tells Ben that the seat was just taken, offering other seats. No double booking happened." },
      ],
    },
    example: {
      title: "Worked example: check then write goes wrong",
      text: "A naive booking does two steps: select the seat to check it is free, then insert a booking. At 500 requests per second for a popular show, it is common for two requests to run the select at the same moment, both see \"free\", and both insert. The fix is not a quicker check. It is to merge both steps into one atomic action, for example an insert into a table with a unique rule on show and seat. The second insert fails with a clear error, and the application turns that into \"seat taken\". Even if the application code has a bug, the database refuses to store two bookings for the same seat.",
    },
    tradeoff: {
      title: "Optimistic against pessimistic locking",
      gain: {
        label: "Optimistic gives",
        items: [
          "No waiting when conflicts are rare",
          "No locks held, so slow clients block nobody",
          "Simple conditional updates that work with many databases",
        ],
      },
      cost: {
        label: "Pessimistic gives",
        items: [
          "Certainty for the first requester, as the data is reserved",
          "Fewer wasted attempts when conflicts are common",
          "But waiting requests and a risk of deadlock if locks are taken in different orders",
        ],
      },
    },
    lab: "ticket-booking",
    pitfalls: [
      "Reading availability and writing a booking as two separate, unguarded operations.",
      "Relying on application code alone for a rule, when a database constraint would make it impossible to break.",
      "Holding a transaction open while waiting for a user or a slow external call, which blocks others.",
    ],
    remember: [
      "A transaction makes several changes succeed or fail together.",
      "Check-then-write is a race; make the decision in one atomic step.",
      "Let the database enforce the invariant with a constraint.",
      "Keep transactions short and always handle the loser's case.",
    ],
    interview: [
      "Draw two concurrent requests and point to the exact operation that lets only one of them win.",
      "Explain what the loser sees and how the user is told, not only how the winner is chosen.",
    ],
    quizzes: [
      {
        question: "Two requests both check that the last ticket is free and both then insert a booking. What is the root cause?",
        options: [
          "The server did not have enough memory to hold the ticket",
          "The database had too few indexes on the ticket table",
          "The check and the write were separate, unguarded steps",
          "The users clicked the button much too quickly",
        ],
        answer: 2,
        why: "Between the check and the write, the state changed. The decision must be made in one atomic step, or protected by a version check or a constraint.",
      },
      {
        question: "An update says \"set status to booked WHERE id = 14 AND version = 7\" and affects zero rows. What does this mean?",
        options: [
          "Another writer got there first, so retry or refuse",
          "The database crashed and the booking has been lost for good",
          "The booking worked and zero is the usual success value",
          "The version number should now be removed from the table",
        ],
        answer: 0,
        why: "The version had already moved on, so the condition failed. Zero changed rows is how optimistic locking reports that another writer got there first.",
      },
      {
        question: "Why is a uniqueness constraint on (show, seat) valuable even when the code already checks availability?",
        options: [
          "It makes every query on the table run much faster",
          "It removes the need for any transactions at all",
          "It stores each seat's history for later reporting",
          "It still blocks duplicates if the code has a bug",
        ],
        answer: 3,
        why: "The database applies the rule to every writer, whatever the application does. If a race or bug slips past the code, the constraint refuses the second booking.",
      },
    ],
  },
  {
    slug: "leader-election-and-leases",
    title: "Leader Election and Leases",
    summary: "Choose one temporary coordinator without pretending it can never lose authority.",
    intro: [
      "Some jobs must be done by only one machine at a time, such as running a scheduler, assigning sequence numbers or managing a data partition. Leader election is how a group of machines agrees on which one is in charge. To avoid a dead leader holding power forever, leadership is given as a lease, a permission that expires unless the leader renews it.",
      "The tricky case is a leader that is merely paused, perhaps by a long garbage collection or a slow network, not dead. The group moves on and elects a new leader, then the old one wakes up still believing it is in charge. A fencing token solves this. Each new leader gets a higher number, and the storage layer rejects any command carrying an older number.",
    ],
    analogy: [
      "A speaking token in a debate",
      "Only the person holding the unexpired token may announce the next decision. If time runs out, the group issues a newer token to somebody else. If the first speaker dozes off and wakes up later, the group simply ignores their old token.",
    ],
    glossary: [
      ["leader", "The one process temporarily allowed to coordinate a job."],
      ["lease", "A permission to lead that expires unless it is renewed in time."],
      ["quorum", "A majority of members whose agreement is needed to make a decision safely."],
      ["fencing token", "An ever-increasing number sent with commands so that a stale leader's writes can be rejected."],
    ],
    walkthrough: {
      title: "Follow a scheduler that pauses",
      steps: [
        { label: "Win the lease", text: "Scheduler A asks a coordination service for leadership. A majority agrees, and A gets a 10-second lease with fencing token 41." },
        { label: "A goes quiet", text: "A freezes for 15 seconds, perhaps in a long pause. It cannot renew its lease, so after 10 seconds the lease expires." },
        { label: "B takes over", text: "Scheduler B asks for leadership, wins and receives token 42. B begins starting jobs and tells the job store its token is 42." },
        { label: "A wakes up", text: "A resumes, still thinking it is the leader, and tries to write with token 41. The job store has seen 42, so it rejects A's write." },
      ],
    },
    example: {
      title: "Worked example: the double-run that fencing prevents",
      text: "A nightly billing job must run once. Without fencing, A starts the job, pauses mid-way, and loses its lease; B takes over and starts the job again. When A wakes, both write results, and customers are billed twice. With fencing, every write to the billing store carries the token. After B writes with token 42, the store refuses anything with a lower number. The expiry alone is not enough, because it tells everyone else to move on but cannot stop a slow process from acting. The check at the storage layer is the real protection.",
    },
    tradeoff: {
      title: "A single coordinator buys simplicity",
      gain: {
        label: "You gain",
        items: [
          "One clear owner for jobs that must not run twice",
          "Automatic replacement when the leader fails",
          "Safe handover when fencing tokens are checked by storage",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A short gap with no leader while a new one is chosen",
          "A coordination service that must itself stay available",
          "Extra care with clocks, slow processes and renewal timing",
        ],
      },
    },
    pitfalls: [
      "Assuming a timed-out leader has stopped; a paused process may resume and write stale decisions.",
      "Trusting clocks that differ between machines to decide when a lease has ended.",
      "Electing a leader but never checking its authority at the place where data is changed.",
    ],
    remember: [
      "Leadership is a lease that must be renewed.",
      "A lease alone cannot stop a slow old leader.",
      "Fencing tokens let storage reject stale commands.",
      "Decisions need a majority so two leaders cannot both be chosen.",
    ],
    interview: [
      "Walk through a leader pause, a replacement election and the old leader's rejected write.",
      "Name what happens in the gap with no leader and how long you would accept it.",
    ],
    quizzes: [
      {
        question: "A leader's lease expires while it is paused. A new leader is elected. What can still go wrong?",
        options: [
          "The old leader may resume and act as if still in charge",
          "The new leader can never be chosen without the old one",
          "The lease will extend itself indefinitely once it expires",
          "All machines will immediately stop working until restart",
        ],
        answer: 0,
        why: "Expiry tells the others to move on, but it does not stop the paused process. Without further protection, it can wake up and make changes that conflict with the new leader.",
      },
      {
        question: "Scheduler A holds token 41 and B holds 42. A sends a write. What should the storage layer do?",
        options: [
          "Accept it, since it arrived earlier than B's writes",
          "Reject it, since its token is below the newest",
          "Accept it and then ask B whether it agrees",
          "Merge the two writes by averaging their contents",
        ],
        answer: 1,
        why: "A lower token means an older leader. Rejecting it ensures only the current leader can change state, whatever order the messages arrive in.",
      },
      {
        question: "Why does electing a leader usually require agreement from a majority of members?",
        options: [
          "A majority is quicker to collect than a single vote",
          "Any two majorities overlap, so two leaders cannot win",
          "Majority voting removes the need for a lease and a token",
          "Smaller groups cannot hold a vote under any circumstances",
        ],
        answer: 1,
        why: "Any two majorities of the same group share at least one member, and that member will not back two different leaders at once. This prevents two leaders being elected during a partition.",
      },
    ],
  },
  {
    slug: "queues-streams-and-backpressure",
    title: "Queues, Streams and Backpressure",
    summary: "Decouple producers from slower work without hiding overload forever.",
    intro: [
      "A queue holds work between a producer and a consumer. The producer adds a message and carries on, and a consumer picks it up later. A stream is a similar idea, but it keeps an ordered log that several consumers can read at their own pace. Both let a slow task, such as sending email or resizing an image, happen outside the user's request.",
      "Queues smooth out bursts, but they do not create capacity. If messages arrive faster than they are handled for long enough, the queue only grows and delays get longer. Most queues also deliver a message at least once, so a consumer may see the same message twice and must handle that. Backpressure is the set of rules that keep the queue from growing without limit, such as slowing producers or refusing work.",
    ],
    analogy: [
      "A tray between the kitchen and the waiters",
      "The tray absorbs a short rush, so the cooks are not blocked while waiters are busy. But if dishes arrive faster than they are carried out for a long time, the tray fills. Someone then has to slow the orders, add waiters or turn customers away.",
    ],
    glossary: [
      ["queue", "A buffer that holds messages until a consumer takes them."],
      ["consumer", "A process that takes messages from a queue and does the work."],
      ["acknowledgement", "A signal from the consumer that a message was handled and can be removed."],
      ["at-least-once delivery", "A promise that each message arrives once or more, so duplicates are possible."],
      ["backpressure", "Any mechanism that slows or limits producers when consumers cannot keep up."],
    ],
    walkthrough: {
      title: "Follow a photo upload through a queue",
      steps: [
        { label: "Accept quickly", text: "A user uploads a photo. The API saves it and puts a message `resize photo 8841` on a queue, then replies at once." },
        { label: "Consumer works", text: "A worker takes the message and starts resizing. The queue keeps the message but hides it from other workers for a short time." },
        { label: "Acknowledge or retry", text: "If the worker finishes, it acknowledges and the message is deleted. If the worker crashes, the message reappears and another worker repeats the job." },
        { label: "Handle overload", text: "On a busy day uploads outrun the workers and the queue grows. The system adds workers, and past a set limit it tells the app to pause new uploads." },
      ],
    },
    example: {
      title: "Worked example: how fast does a backlog grow?",
      text: "Photos arrive at 50 per second but workers handle only 40 per second. The backlog grows by 10 messages every second, so after an hour there are 36,000 waiting. A photo added then waits 36,000 divided by 40, which is 900 seconds or 15 minutes. If the thumbnail is useless after a few minutes, the work is stale before it starts. Options are to add workers until capacity exceeds 50 per second, to drop or skip old messages, or to refuse uploads while the queue is long. Because delivery is at least once, the resize step should also be safe to run twice for photo 8841.",
    },
    tradeoff: {
      title: "Asynchronous work buys speed and costs certainty",
      gain: {
        label: "You gain",
        items: [
          "Fast replies to users, with slow work done in the background",
          "Bursts are smoothed so workers run at a steady pace",
          "Producers and consumers can fail and scale independently",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "The user does not see the result immediately",
          "Duplicates, ordering and failed messages must be handled",
          "A growing backlog can hide an overload until delays are very long",
        ],
      },
    },
    pitfalls: [
      "Treating a queue as infinitely scalable and ignoring stale work piling up behind it.",
      "Writing a consumer that is not safe to run twice, then paying for duplicate emails or charges.",
      "Retrying a poison message that always fails forever, which blocks everything behind it.",
    ],
    remember: [
      "A queue absorbs bursts but does not add capacity.",
      "Assume messages can be delivered more than once.",
      "Set a limit on backlog and decide what happens when it is hit.",
      "Move repeatedly failing messages aside for review.",
    ],
    interview: [
      "Choose synchronous or asynchronous from the user's need for an immediate result, then explain how failures are recovered.",
      "Describe the maximum useful backlog age and the action taken when it is exceeded.",
    ],
    quizzes: [
      {
        question: "Messages arrive at 50 per second and consumers handle 40 per second. What happens over time?",
        options: [
          "The queue stays the same size because of buffering",
          "The queue grows steadily and delays keep increasing",
          "The consumers speed up to match the arriving messages",
          "The extra messages are deleted without anyone noticing",
        ],
        answer: 1,
        why: "A queue only smooths short bursts. If input exceeds processing for long, the difference accumulates and each new message waits longer than the last.",
      },
      {
        question: "A worker crashes halfway through a job before acknowledging it. With at-least-once delivery, what happens next?",
        options: [
          "The job is lost and the user must submit it again",
          "It is handled again, perhaps by another worker",
          "The queue permanently stops accepting any new messages",
          "The producer is told to pause for the next hour",
        ],
        answer: 1,
        why: "Without an acknowledgement, the queue assumes the work was not done and delivers the message again. That is why consumers must be safe to run twice.",
      },
      {
        question: "One malformed message makes the consumer fail every time it is retried. What is a good way to handle it?",
        options: [
          "Retry it forever until it eventually works",
          "Delete every message in the queue to clear the fault",
          "Stop all consumers until the sender fixes the format",
          "Move it to a failure queue after a few attempts",
        ],
        answer: 3,
        why: "A poison message keeps failing and blocks useful work. After a limited number of attempts it should be set aside for someone to examine, while others carry on.",
      },
    ],
  },
  {
    slug: "rate-limits-retries-and-circuits",
    title: "Rate Limits, Retries and Circuit Breakers",
    summary: "Keep one struggling dependency from becoming a system-wide failure.",
    intro: [
      "A rate limit caps how much work a caller may send in a period, for example 100 requests per minute per user. Timeouts cap how long you wait for an answer. Retries try again after a failure, and a circuit breaker stops calling a dependency that keeps failing, so it has time to recover. These four tools work together to stop one weak part from dragging down the rest.",
      "Retries are the dangerous one. A retry helps when a failure was a brief blip, but when a dependency is overloaded, retries add even more load and make the outage longer. Good retries wait longer each time (exponential backoff), add a little randomness (jitter) so clients do not all return together, and stop after a small budget.",
    ],
    analogy: [
      "A clinic with appointments and an emergency stop",
      "Appointments spread patients over the day so the doctor is not swamped. If the doctor is unwell, sending the whole queue back to knock on the door every minute only makes the hallway worse. Better to put up a sign, wait, and try again later.",
    ],
    glossary: [
      ["rate limit", "A cap on how many requests a caller may make in a given period."],
      ["timeout", "The longest time you will wait for a reply before giving up."],
      ["exponential backoff", "Waiting longer after each failed attempt, for example 1, 2, 4 and then 8 seconds."],
      ["jitter", "A small random variation added to waits so many clients do not retry at the same moment."],
      ["circuit breaker", "A switch that stops calls to a failing dependency for a while, so it can recover."],
    ],
    walkthrough: {
      title: "Follow calls to a failing payment service",
      steps: [
        { label: "Calls start to fail", text: "The payment service becomes slow. Calls hit a 2-second timeout, so a request never waits forever." },
        { label: "Retry with care", text: "The caller retries after 1 second, then 2, each time with a little random jitter, and gives up after three tries." },
        { label: "The breaker opens", text: "After ten failures in a row, the circuit breaker opens. For the next 30 seconds, calls fail at once without even trying." },
        { label: "Test and recover", text: "After 30 seconds the breaker lets one trial request through. If it succeeds, the breaker closes and normal traffic resumes." },
      ],
    },
    example: {
      title: "Worked example: how retries multiply",
      text: "A request passes through three layers: the gateway calls the order service, which calls the payment service, which calls the bank. Each layer makes up to 3 attempts. If the bank is down, the payment service makes 3 calls to it for one request. But the order service also makes 3 attempts at the payment service, so the bank sees 9 calls. The gateway does the same, which makes 27 calls to the bank for one user click. A few thousand users and a struggling bank now face tens of thousands of calls. The fix is to retry in one layer only, set an overall deadline, and let a breaker stop the rest.",
    },
    tradeoff: {
      title: "Protection against complexity",
      gain: {
        label: "You gain",
        items: [
          "A failing dependency gets room to recover",
          "Users get a quick, clear answer instead of a long wait",
          "Fair budgets stop one heavy caller from starving others",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Limits and breakers need tuning, and wrong settings reject good traffic",
          "Retries can duplicate work unless the operation is idempotent",
          "More states and settings make behaviour harder to reason about",
        ],
      },
    },
    pitfalls: [
      "Retrying every failure immediately at every layer, which multiplies load on a struggling service.",
      "Retrying a payment-like operation without an idempotency key, so the action happens twice.",
      "Setting no timeouts, so slow calls pile up and use all of a service's threads.",
    ],
    remember: [
      "Always set a timeout.",
      "Retry with backoff, jitter and a small budget.",
      "Retry in one layer, not at every layer.",
      "A circuit breaker gives a failing dependency room to recover.",
    ],
    interview: [
      "Calculate how three retries across three layers can magnify one failed request into dozens of calls.",
      "Describe a degraded response, such as showing saved data, for when a dependency is unavailable.",
    ],
    quizzes: [
      {
        question: "A dependency is overloaded and slow. Every client retries immediately after a failure. What is the likely result?",
        options: [
          "The dependency recovers faster because it gets practice",
          "Clients waste time but the dependency is unaffected",
          "The extra retry load makes the overload worse",
          "Retries are blocked automatically by the network",
        ],
        answer: 2,
        why: "Immediate retries add to the load on something already struggling, which prolongs the failure. Backoff and jitter spread retries out and give it time to recover.",
      },
      {
        question: "What does jitter add to exponential backoff?",
        options: [
          "Random variation, so retries from many clients are spread out",
          "A guarantee that every retry will succeed on the next try",
          "A longer maximum wait than the backoff alone would give",
          "A count of how many failures each client has seen",
        ],
        answer: 0,
        why: "Without jitter, clients that failed together retry together in waves. A little randomness spreads the retries over time.",
      },
      {
        question: "A circuit breaker is open. What happens to a new call to the failing service?",
        options: [
          "It waits for the full timeout, as it normally would",
          "It fails straight away, without trying the service",
          "It is queued until the service comes back online",
          "It is sent to every other service instead",
        ],
        answer: 1,
        why: "An open breaker rejects calls immediately. That saves the caller from long waits and stops it adding load while the dependency recovers.",
      },
    ],
  },
  {
    slug: "polling-websockets-and-sse",
    title: "Polling, Long Polling, WebSockets and SSE",
    summary: "Choose how a client learns that something changed without wasting work or hiding reconnects.",
    intro: [
      "A web page often needs to learn that something changed on the server. There are four common ways. Polling asks again and again on a timer. Long polling asks once, and the server holds the request open until it has news or a timeout passes. Server-Sent Events (SSE) keep one connection open over which the server pushes updates to the browser. A WebSocket keeps a connection open that both sides can send on.",
      "The simplest method that meets the need is usually the best. Open connections cost the server memory, and every method must still handle login checks, dropped connections and updates missed while offline. A page that updates once a minute does not need a permanent connection to every visitor. A chat that must feel instant probably does.",
    ],
    analogy: [
      "Check the noticeboard, wait at reception or stay on a call",
      "You can walk past a noticeboard every few minutes, which wastes trips when nothing has changed. You can ask reception to tell you the moment news arrives. Or you can stay on a call and talk both ways. Each costs a different amount of effort and keeps a different amount of line busy.",
    ],
    glossary: [
      ["polling", "The client asks repeatedly, on a timer, whether anything has changed."],
      ["long polling", "The server holds a request open until it has an update or a timeout."],
      ["SSE", "A browser feature for a one-way stream of events from server to client."],
      ["WebSocket", "A long-lived connection over which client and server can both send messages."],
      ["heartbeat", "A small regular message that shows the connection is still alive."],
    ],
    walkthrough: {
      title: "Follow a chat message over a WebSocket",
      steps: [
        { label: "Open the channel", text: "The chat app starts as an ordinary web request, then upgrades to a WebSocket. The server checks the user's login before accepting it." },
        { label: "Send and receive", text: "Asha types a message. It travels up the open connection, and the server passes it down to Ben's open connection within moments." },
        { label: "Stay alive", text: "Every 30 seconds each side sends a small heartbeat. If none arrives for a while, the connection is treated as dead and closed." },
        { label: "Reconnect and catch up", text: "Ben's train enters a tunnel and the connection drops. On reconnecting, his app sends the ID of the last message it saw, and the server sends everything after it." },
      ],
    },
    example: {
      title: "Worked example: matching the method to the page",
      text: "A job-status page changes every few seconds at most, and a visitor looks at it for a minute. Polling every 5 seconds means 12 requests a minute per visitor, which is simple and fine. A news ticker pushes updates from the server only, so SSE fits and reconnects on its own. A chat needs messages both ways, so a WebSocket is natural. Now count the cost: with a million visitors on a page that changes once a minute, holding a million open connections just to say nothing most of the time is much more expensive than a simple poll every 30 seconds.",
    },
    tradeoff: {
      title: "Instant updates against simplicity and cost",
      gain: {
        label: "You gain",
        items: [
          "Push methods deliver updates the moment they happen",
          "Polling is simple, stateless and easy to cache and scale",
          "WebSockets allow fast two-way messaging",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Open connections use memory and need limits and monitoring",
          "Push methods need reconnect and catch-up logic",
          "Polling wastes requests when nothing has changed",
        ],
      },
    },
    pitfalls: [
      "Choosing WebSockets for a page that refreshes once a minute, then operating millions of idle connections.",
      "Forgetting what happens when a connection drops, so users silently miss updates.",
      "Skipping heartbeats, so half-dead connections stay open and hold resources.",
    ],
    remember: [
      "Pick the simplest method that meets the update speed and direction.",
      "SSE is one way, server to client; a WebSocket is two way.",
      "Every push method needs reconnect and catch-up.",
      "Idle connections still cost memory.",
    ],
    interview: [
      "Compare all four methods for a dashboard, notifications and two-way chat, and say which you would use for each.",
      "Explain how a client recovers messages it missed while disconnected.",
    ],
    quizzes: [
      {
        question: "A page shows a report that changes once every few minutes, for up to a million visitors. Which method is most sensible?",
        options: [
          "A WebSocket for every visitor, kept open all day",
          "Polling every 30 seconds or so, with cached responses",
          "A custom protocol that needs special browser software",
          "Long polling with a one-hour wait on every request",
        ],
        answer: 1,
        why: "The data changes slowly, so occasional polling is cheap, simple and cacheable. A million permanent connections would cost a great deal for very little benefit.",
      },
      {
        question: "Which situation fits Server-Sent Events best?",
        options: [
          "A multiplayer game where players send moves constantly",
          "A video call that sends audio in both directions",
          "A live score feed that only the server updates",
          "A file upload that needs progress from the browser",
        ],
        answer: 2,
        why: "SSE is a one-way stream from server to browser, which suits a feed that only the server updates. Both-way traffic is what WebSockets are for.",
      },
      {
        question: "A phone loses signal for 20 seconds in a chat app and then reconnects. What is a sound way to recover?",
        options: [
          "Ask the server for messages after the last one it saw",
          "Assume nothing was sent and show an empty chat",
          "Make the user close the app and sign in again",
          "Re-send every old message again from the start",
        ],
        answer: 0,
        why: "Remembering the last message ID lets the client ask for exactly what it missed. Without catch-up, any connection drop silently loses updates.",
      },
    ],
  },
  {
    slug: "object-storage-and-cdns",
    title: "Files, Object Storage and CDNs",
    summary: "Store large immutable objects cheaply and deliver them near users.",
    intro: [
      "Object storage keeps files, such as photos, videos and documents, as whole objects under a name, and is designed to hold huge numbers of them cheaply and durably. You do not edit part of an object; you replace it. A content delivery network (CDN) is a set of servers around the world that keep copies of popular objects, so a viewer fetches from a nearby server instead of a far-away origin.",
      "The usual pattern keeps file bytes in object storage and only a small record about each file, such as its owner, name and size, in the database. Uploads can go straight to storage using a short-lived signed URL, so large files never pass through your application servers. Downloads are then served through a CDN, with access rules that decide who may see what.",
    ],
    analogy: [
      "A warehouse with nearby display shelves",
      "The warehouse keeps the durable stock of every item. Shelves in shops near customers hold popular items so people can buy them quickly. When a shelf is empty or an item is replaced, it is refilled from the warehouse.",
    ],
    glossary: [
      ["object storage", "A service that stores whole files as named objects, built for very large amounts of data."],
      ["metadata", "Small facts about a file, such as owner, name, type and size, kept in a database."],
      ["signed URL", "A temporary web address that grants permission to upload or download one object until it expires."],
      ["CDN", "A network of servers near users that cache copies of objects for fast delivery."],
      ["origin", "The main storage or server the CDN fetches objects from when it has no copy."],
    ],
    walkthrough: {
      title: "Follow a profile photo from upload to display",
      steps: [
        { label: "Ask for permission", text: "The app asks the API to upload a photo. The API checks the user, creates a record with status `pending` and returns a signed URL valid for 10 minutes." },
        { label: "Upload directly", text: "The phone sends the file straight to object storage with that URL. The bytes never touch the API servers." },
        { label: "Confirm and check", text: "Storage tells the API the upload finished. The API checks the type and size, scans it, and marks the record `ready`." },
        { label: "Serve through the CDN", text: "Pages point at a CDN address. The first viewer in a region causes a fetch from storage, and later viewers there get the cached copy." },
      ],
    },
    example: {
      title: "Worked example: updating a cached photo",
      text: "A user changes their profile photo, but the CDN has the old one cached for 24 hours at the same address, so friends still see the old picture. One fix is to ask the CDN to purge that address, which works but can be slow and costs a call. A neater fix is to never change an object: store the new photo under a new name, such as `photos/u77-v2.jpg`, and update the record to point to it. The old address stays cached harmlessly until it ages out, and the new address is fetched fresh. Versioned names avoid invalidation entirely.",
    },
    tradeoff: {
      title: "Cheap and fast delivery, with new rules to learn",
      gain: {
        label: "You gain",
        items: [
          "Very cheap storage with high durability for large files",
          "Application servers are freed from moving large uploads",
          "Viewers get files from a nearby server, so pages load faster",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Objects are replaced as a whole, not edited in place",
          "Cached copies can be old until they expire or the name changes",
          "Access control, scanning and deletion need deliberate design",
        ],
      },
    },
    pitfalls: [
      "Storing large file bytes directly in a frequently queried relational table.",
      "Making signed URLs long-lived or reusable, so a leaked link gives access for days.",
      "Deleting the database record but forgetting the stored object and its cached copies.",
    ],
    remember: [
      "Bytes in object storage, metadata in the database.",
      "Use short-lived signed URLs for upload and private download.",
      "Prefer new object names over trying to overwrite cached ones.",
      "Deleting a file means the object and its copies, not just the row.",
    ],
    interview: [
      "Trace both the upload and download paths, including access control and what happens if an upload is interrupted.",
      "Say how an updated file reaches viewers when the CDN still holds the old one.",
    ],
    quizzes: [
      {
        question: "A 2 GB video is uploaded through the application server, and the servers slow down. What is a better design?",
        options: [
          "Add more memory to every application server",
          "Limit uploads to one user at a time",
          "Store the video inside the main database table",
          "Upload directly to storage with a signed URL",
        ],
        answer: 3,
        why: "A signed URL lets the client send the file straight to storage, so large bytes never pass through the application servers. The API only issues permission and records the result.",
      },
      {
        question: "A CDN has cached `logo.png` for a day, and the company changes the logo. What is the cleanest way to roll it out?",
        options: [
          "Publish it as `logo-v2.png` and change the references",
          "Ask every visitor to clear their browser cache by hand",
          "Overwrite `logo.png` and simply wait for a full day",
          "Remove the CDN until the old logo expires on its own",
        ],
        answer: 0,
        why: "A new name is a new address, so no stale copy can be served for it. The old address ages out unnoticed, and no purge is needed.",
      },
      {
        question: "A user deletes their account. Which action is complete?",
        options: [
          "Removing only the user's row from the database",
          "Removing the row, the stored objects and any cached copies",
          "Hiding the user's files from the website's front page",
          "Renaming the files so that they are harder to find",
        ],
        answer: 1,
        why: "The bytes in object storage, and copies held by a CDN, remain unless they are deleted or expired. Deleting only the row leaves personal data behind.",
      },
    ],
  },
  {
    slug: "safe-configuration-and-deployment",
    title: "Safe Configuration and Deployment",
    summary: "Release a tested, immutable artifact gradually and make rollback a designed action.",
    intro: [
      "Deployment means getting new code running for real users. A safe process builds one package, called an artifact, tests it, and then promotes that same package from test to staging to production without rebuilding it. Settings that differ between environments, such as addresses and passwords, are kept outside the artifact as configuration, and are checked before they take effect.",
      "The risk is releasing a mistake to everyone at once. A canary release sends the new version to a small slice of users first. Automated checks watch errors and delays, and roll back if they get worse. Rollback is not an emergency improvisation; it is designed in, so you can return to the previous version quickly and safely, including when the database has changed.",
    ],
    analogy: [
      "Serve one table before the whole banquet",
      "A cook tries a new dish at one table, watches the guests' faces and keeps the previous dish ready. If it is a failure, only one table is affected and the old dish is brought out at once. If guests are happy, the dish goes to the rest of the room.",
    ],
    glossary: [
      ["immutable artifact", "One build whose contents never change as it moves between environments."],
      ["canary", "A small first group of users or machines that gets a new version before everyone else."],
      ["blue-green", "Two full environments, one live and one new, between which traffic can be switched."],
      ["feature flag", "A switch that separates deploying code from turning a feature on for users."],
    ],
    walkthrough: {
      title: "Follow version 18 into production",
      steps: [
        { label: "Build once", text: "Version 18 is built and tested as one package. The same package, with the same bytes, is what goes to every later environment." },
        { label: "Canary", text: "It is deployed to 1 per cent of machines while version 17 keeps serving the rest. The new settings are validated before they are loaded." },
        { label: "Watch the signals", text: "A controller compares error rate and the slowest 5 per cent of responses between the two versions for ten minutes." },
        { label: "Promote or roll back", text: "If the numbers are healthy, the release widens to 10, then 50, then 100 per cent. If errors rise, traffic returns to version 17 without anyone being woken." },
      ],
    },
    lab: "safe-deployment",
    example: {
      title: "Worked example: renaming a column safely",
      text: "A team wants to rename a database column from `name` to `full_name`. If they rename it and deploy new code together, then during a rolling release some machines run old code that still asks for `name` and fail. A safe sequence uses small steps. First add the new column and write to both. Then deploy code that reads the new column. Later, once no old version is running and a rollback is no longer needed, drop the old column. Every step works with both the version before and the version after it, so each can be rolled back on its own.",
    },
    tradeoff: {
      title: "Gradual release buys safety and costs time",
      gain: {
        label: "You gain",
        items: [
          "A bad release harms only a small slice of users",
          "Automatic rollback shortens the time a fault lasts",
          "The same tested package runs everywhere, with no surprise differences",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Releases take longer than flipping everything at once",
          "Two versions run side by side, so changes must work with both",
          "Health gates and rollback tooling need building and maintaining",
        ],
      },
    },
    pitfalls: [
      "Rebuilding different binaries for each environment, so what was tested is not what runs.",
      "Changing database assumptions before old application versions stop running.",
      "Putting secrets in the artifact or in the code repository.",
    ],
    remember: [
      "Build once; promote the same package.",
      "Release to a small group first and watch real signals.",
      "Make every change work with the version before and after it.",
      "Practise rollback before you need it.",
    ],
    interview: [
      "Compare rolling, blue-green and canary releases, and say when each is the better fit.",
      "Describe a database-compatible sequence for a change, with a rollback point at each step.",
    ],
    quizzes: [
      {
        question: "A canary at 1 per cent shows twice the usual error rate. What should happen?",
        options: [
          "Widen the release, since 1 per cent is too small to matter",
          "Return traffic to the previous version and investigate",
          "Wait a week to see if the errors go away on their own",
          "Restart the old version so that it matches the canary",
        ],
        answer: 1,
        why: "The purpose of a canary is to catch harm while it touches few users. A clear rise in errors is the signal to roll back, not to continue.",
      },
      {
        question: "Why promote the same artifact through every environment instead of rebuilding it each time?",
        options: [
          "Rebuilding is not possible once the tests have passed",
          "A new build is always slower than reusing the old one",
          "What was tested is exactly what reaches production",
          "Environments cannot hold more than one kind of package",
        ],
        answer: 2,
        why: "A fresh build can differ from the tested one in small, hidden ways. Reusing the same package means the tests you ran apply to what is released.",
      },
      {
        question: "A new release drops a database column that the previous version still reads. What goes wrong if the release is rolled back?",
        options: [
          "Nothing, because old code never needs old columns",
          "The old version fails, since the column it needs is gone",
          "The database automatically recreates the dropped column",
          "The old version converts itself to use the new one",
        ],
        answer: 1,
        why: "Rollback returns to code that expects the earlier structure. Removing something it needs makes rollback break the system. Dropping should wait until the old version can never run again.",
      },
    ],
  },
  {
    slug: "peer-to-peer-systems",
    title: "Peer-to-Peer Systems",
    summary: "Let participants exchange data directly while planning discovery, unreachable devices and untrusted peers.",
    intro: [
      "In a peer-to-peer system, the participants, called peers, can both ask for data and provide it. A small discovery service may introduce peers to one another, but the bulk of the data then moves directly between them. This spreads the bandwidth cost across users and can keep working when one peer disappears.",
      "That freedom brings hard problems. Most home devices sit behind routers that block incoming connections, peers come and go, upload speeds differ widely, and anyone can be dishonest. Every byte received from a peer must be treated as untrusted and verified. Because of these limits, real systems keep a trusted component, such as a manifest of checksums or a fallback origin server.",
    ],
    analogy: [
      "Classmates share missing notes with one another",
      "Instead of everyone asking one teacher to photocopy every page, classmates trade the pages they already have. They still need a class list to find each other, a way to reach people who are not at the same desk, and a check that nobody has altered the notes they pass on.",
    ],
    glossary: [
      ["peer", "A participant that can both request and provide data."],
      ["discovery", "The first step that helps a peer find others to connect to."],
      ["NAT traversal", "Techniques for connecting devices that sit behind home or office routers."],
      ["content hash", "A fingerprint of data, used to check that received bytes match the trusted original."],
      ["relay", "A server that forwards traffic when two peers cannot connect directly."],
    ],
    walkthrough: {
      title: "Follow a peer-assisted software download",
      steps: [
        { label: "Get the manifest", text: "A device downloads a small trusted manifest from the publisher. It lists each chunk of the file and a hash for each." },
        { label: "Find peers", text: "It asks a discovery service for devices that hold chunks. The service returns a list of candidates." },
        { label: "Download in parallel", text: "It fetches different chunks from different peers at once, and checks each chunk against its hash before keeping it." },
        { label: "Fall back", text: "One home network refuses incoming connections, and one peer leaves. The device gets those chunks from a relay or the publisher's own server." },
      ],
    },
    example: {
      title: "Worked example: bandwidth saved on a 2 GB update",
      text: "A publisher releases a 2 GB update to 100,000 devices. From its own servers, that is 200 TB of outgoing traffic. If peers supply, say, 70 per cent of the chunks to each other, the publisher sends about 60 TB, a saving of 140 TB. But the saving depends on peers being online and reachable, which varies a lot, so the publisher keeps its own server as a fallback. Every chunk is checked against its hash; if a peer sends a corrupted or altered chunk, the device throws it away and asks someone else. The manifest must come from the trusted publisher, because the hash is only as trustworthy as its source.",
    },
    tradeoff: {
      title: "Shared load against less control",
      gain: {
        label: "You gain",
        items: [
          "Less bandwidth cost for the publisher on large, popular content",
          "More capacity as more peers join",
          "No single sender whose failure stops everyone",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Peers may be unreachable, slow or offline without warning",
          "Every received byte must be verified, because peers may be dishonest",
          "Peers see each other's addresses, which raises privacy questions",
        ],
      },
    },
    pitfalls: [
      "Assuming every device accepts incoming connections.",
      "Trusting a chunk merely because several peers offered it.",
      "Offering no fallback, so a rare chunk that nobody holds can never be completed.",
    ],
    remember: [
      "Peers both request and provide data.",
      "Verify every chunk against a trusted hash.",
      "Keep a trustworthy discovery path and a fallback source.",
      "Plan for devices behind routers that block connections.",
    ],
    interview: [
      "Compare client-server delivery with peer-assisted delivery, then explain bootstrap, failure and content verification.",
      "Say who is trusted in your design, and what happens if a peer lies.",
    ],
    quizzes: [
      {
        question: "A peer sends a chunk whose hash does not match the manifest. What should the receiving device do?",
        options: [
          "Keep the chunk, as it came from a real peer",
          "Discard it and fetch the chunk from someone else",
          "Install it anyway, then check it at a later date",
          "Stop the whole download and delete everything so far",
        ],
        answer: 1,
        why: "A mismatch means the data is corrupted or tampered with. The chunk is thrown away and obtained elsewhere, while the rest of the download carries on.",
      },
      {
        question: "Many home devices cannot accept incoming connections. How should a design cope?",
        options: [
          "Exclude these devices so they never receive any files",
          "Assume they will all open their routers by themselves",
          "Use relays or a fallback server when a direct link fails",
          "Send their data again and again until a link works",
        ],
        answer: 2,
        why: "Routers commonly block unsolicited incoming connections. A relay or the origin server lets those devices still complete the download.",
      },
      {
        question: "Why does a peer-to-peer download still need a trusted manifest from the publisher?",
        options: [
          "It makes the download faster by skipping peer checks",
          "It lets peers talk without using any network",
          "It removes the need for any discovery step",
          "It gives trusted hashes to verify untrusted chunks",
        ],
        answer: 3,
        why: "Peers cannot be trusted, so chunks are checked against hashes. Those hashes must come from a source you trust, or an attacker could supply matching fakes.",
      },
    ],
  },
  {
    slug: "batch-processing-and-mapreduce",
    title: "Batch Processing and MapReduce",
    summary: "Process a large, bounded dataset by splitting independent work and combining results.",
    intro: [
      "Batch processing handles a large, finite set of data in one job, such as yesterday's logs or this month's orders. Nobody waits on the answer in real time, so the job can take minutes or hours and use many machines. The input is split into pieces, each piece is processed independently, and the partial results are combined.",
      "MapReduce is the classic pattern. In the map step, each worker turns its records into key-value pairs. A shuffle step then brings together all pairs with the same key. In the reduce step, each worker combines the values for its keys. Because pieces are independent and the input does not change while the job runs, a failed piece can simply be run again.",
    ],
    analogy: [
      "Count votes by table, then add the subtotals",
      "Each table counts its own pile of ballots at the same time. A coordinator then adds up the small subtotals, which is much quicker than one person reading every ballot. If one table miscounts, only that table is counted again.",
    ],
    glossary: [
      ["batch", "A finite group of records processed together as one job."],
      ["map", "The step that turns each input record into one or more key-value pairs."],
      ["shuffle", "The step that moves pairs between workers so that equal keys end up together."],
      ["reduce", "The step that combines all the values for one key into a result."],
    ],
    walkthrough: {
      title: "Follow a count of searches per query",
      steps: [
        { label: "Split the input", text: "Yesterday's search log, 500 million lines, is divided into 500 files of about a million lines each. Workers take the files in turn." },
        { label: "Map", text: "For each line, a mapper emits the pair `(query, 1)`, for example `(\"python tutorial\", 1)`." },
        { label: "Shuffle", text: "The pairs are grouped so that every pair for `python tutorial` reaches the same reducer, whichever mapper produced it." },
        { label: "Reduce and publish", text: "Each reducer adds up its ones and writes the totals to a new, versioned output. A single pointer is then switched, so readers see the full result or none of it." },
      ],
    },
    example: {
      title: "Worked example: when one key is too popular",
      text: "In the search count, a few queries are far more common than the rest. Suppose the query `weather` appears in 8 per cent of all lines, so one reducer receives 40 million of the 500 million pairs while the others get a few thousand each. That reducer finishes hours after the rest, so the whole job waits on it. A common fix is to let each mapper add up its own pairs first, a local combine step, so the reducer receives 500 partial counts for `weather` instead of 40 million ones. The job's speed was decided by the most skewed key, not by the average one.",
    },
    tradeoff: {
      title: "Big, cheap, delayed answers",
      gain: {
        label: "You gain",
        items: [
          "The ability to process very large data on many ordinary machines",
          "Simple recovery: rerun only the pieces that failed",
          "Efficient use of resources, as jobs can run when machines are idle",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Results are only as fresh as the last job",
          "Skewed keys can leave one worker running long after the rest",
          "Moving data in the shuffle step is slow and expensive",
        ],
      },
    },
    pitfalls: [
      "Using an hourly batch job for a fraud decision that must happen before a transaction completes.",
      "Ignoring skewed keys, so one worker holds up the entire job.",
      "Writing results into the live output as they come, so readers see a half-finished answer.",
    ],
    remember: [
      "Batch work suits big, bounded data when results can wait.",
      "Map makes pairs, shuffle groups keys, reduce combines.",
      "Tasks must be safe to retry.",
      "Publish output in one atomic switch.",
    ],
    interview: [
      "Explain which calculations are independent, which key causes the shuffle and how a failed worker retries safely.",
      "Say why batch is or is not right for the question being asked, in terms of how fresh the answer must be.",
    ],
    quizzes: [
      {
        question: "A bank must decide whether to block a card payment before the payment completes. Is a nightly batch job suitable?",
        options: [
          "Yes, because batch jobs are always the most accurate option",
          "Yes, as long as the batch uses enough machines",
          "No, because the decision is needed in real time",
          "No, because batch jobs cannot process payments at all",
        ],
        answer: 2,
        why: "A nightly job produces answers hours after the payment. The decision has to be made while the customer waits, so it needs a real-time path.",
      },
      {
        question: "In a MapReduce job counting words, what does the shuffle step do?",
        options: [
          "It gathers all pairs with the same key onto one worker",
          "It reads the input files and splits them into lines",
          "It sorts the final results into alphabetical order only",
          "It deletes pairs whose count is lower than the average",
        ],
        answer: 0,
        why: "Reducers need every value for a key in one place. The shuffle moves the pairs across the cluster so that equal keys meet.",
      },
      {
        question: "One reducer receives 40 million pairs for a single popular key and runs for hours. What helps most?",
        options: [
          "Buying faster disks for every other worker",
          "Adding many more reducers for the unpopular keys",
          "Combining each mapper's pairs for that key before the shuffle",
          "Restarting the job whenever the slow worker is spotted",
        ],
        answer: 2,
        why: "The imbalance comes from one huge key. Adding up locally first sends far fewer pairs to that reducer, while changes elsewhere leave the skew in place.",
      },
    ],
  },
  {
    slug: "search-and-autocomplete",
    title: "Search, Indexing and Autocomplete",
    summary: "Build a read-optimised view for text lookup and ranked suggestions.",
    intro: [
      "A search engine for your own data builds an inverted index. It splits each document into words, called tokens, and for each word stores a list of the documents that contain it. To answer a query, it looks up each word, combines the lists, and ranks the matches. This is far faster than scanning every document, and it can also handle stemming, so that \"running\" matches \"run\".",
      "Autocomplete is a separate, faster job: after only a few typed letters, suggest likely completions in a fraction of a second. It uses structures built for prefixes. The search index is a derived copy of the main database, not the source of truth. It must be kept up to date as data changes, and it can be rebuilt from the database if lost.",
    ],
    analogy: [
      "A library catalogue beside the shelves",
      "The catalogue holds searchable clues about each book, so you do not walk every shelf. It can be rebuilt from the shelves, but it needs to be updated when books arrive or leave, or it will point you to the wrong place.",
    ],
    glossary: [
      ["inverted index", "A map from each word to the list of documents that contain it."],
      ["token", "A single word or word piece produced when text is split for indexing."],
      ["ranking", "Ordering matches so that the most relevant results come first."],
      ["indexing lag", "The delay between a change in the main database and its appearance in search."],
    ],
    walkthrough: {
      title: "Follow a new course appearing in search",
      steps: [
        { label: "A change happens", text: "An author publishes the course \"Java for Beginners\". The database saves it and emits a change event." },
        { label: "Index it", text: "An indexer lowercases the title, splits it into `java`, `for` and `beginners`, and adds the course to the list for each word." },
        { label: "A query arrives", text: "A learner searches \"java beginners\". The search looks up each term, finds the course in both lists and scores it." },
        { label: "Rank and filter", text: "Results are ordered by relevance, and any the learner is not allowed to see are removed before the page is shown." },
      ],
    },
    example: {
      title: "Worked example: a 2-second delay in the index",
      text: "A shop has 3 million products. Every price change writes to the database first, then an event updates the search index, usually within 2 seconds. During that gap a search may still show the old price. The product page, which reads straight from the database, always shows the right one. The shop accepts this, but it ensures the checkout always uses the database price, never the one found in search results. Compare scanning 3 million rows with `LIKE '%shirt%'` for every search, which gets slower as the shop grows and cannot rank results sensibly.",
    },
    tradeoff: {
      title: "A fast read view with a freshness gap",
      gain: {
        label: "You gain",
        items: [
          "Fast text search, ranking and typo tolerance over large data",
          "Fast prefix lookups for suggestions",
          "The main database is spared heavy search queries",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A second copy of the data that can lag behind the truth",
          "An indexing pipeline to build, monitor and repair",
          "Relevance needs tuning, and permissions must be applied to results",
        ],
      },
    },
    pitfalls: [
      "Using a transactional database scan for every full-text query at scale.",
      "Treating the search index as the source of truth, so a lost index means lost data.",
      "Showing search results the user is not allowed to open because permissions were not applied.",
    ],
    remember: [
      "An inverted index maps words to documents.",
      "Search is a derived read model; the database is the truth.",
      "State the indexing delay the product accepts.",
      "Apply access rules to results, not only to pages.",
    ],
    interview: [
      "Separate finding candidate matches from ranking them, and say which part is hard for this product.",
      "Describe how an update reaches the index, and what a user sees during the gap.",
    ],
    quizzes: [
      {
        question: "A search index goes missing after a failure. What is the correct way to recover?",
        options: [
          "Accept the loss, since search data is unrecoverable",
          "Rebuild it from the source database",
          "Ask users to re-enter all of the data again",
          "Switch off search until the next major release",
        ],
        answer: 1,
        why: "The index is derived from the main database. Rebuilding it from the source restores it, which is why the database remains the single source of truth.",
      },
      {
        question: "A product's price is changed, but search still shows the old price for two seconds. What is the cause?",
        options: [
          "Indexing lag between the database and the index",
          "A bug that stops the database from saving prices",
          "The browser has stopped refreshing the page",
          "The search engine has deleted the product entirely",
        ],
        answer: 0,
        why: "The index is updated after the database, so it can briefly show older data. The product should state the delay it accepts and use database values for important actions.",
      },
      {
        question: "What does an inverted index store?",
        options: [
          "The full text of each document in alphabetical order",
          "A list of every user who has searched for something",
          "The words found in documents, each with its document list",
          "A picture of every page as it appears on screen",
        ],
        answer: 2,
        why: "It maps each word to the documents containing it, which lets a search jump to matches without reading everything.",
      },
    ],
  },
  {
    slug: "observability-slos-and-security",
    title: "Observability, SLOs and Safe Failure",
    summary: "Know what broke, protect data and practise recovery before an incident.",
    intro: [
      "Observability is the ability to understand what a system is doing from the outside. Metrics are numbers over time, such as error rate. Logs are records of individual events. Traces follow one request across many services and show where its time went. A service-level objective (SLO) turns a promise to users into a target, such as \"99.9 per cent of requests succeed each month\".",
      "Good alerts are about symptoms users feel, not every internal wobble. Safe failure is the other half: giving each part only the access it needs, encrypting data, keeping audit records, taking backups, and, importantly, practising restoring them. A backup that has never been restored is only a hope.",
    ],
    analogy: [
      "A car dashboard and a seat belt",
      "The dashboard shows speed, fuel and warnings so you can notice trouble. The seat belt limits the harm if something goes wrong anyway. Neither replaces careful driving, and a warning light you have learned to ignore is no help at all.",
    ],
    glossary: [
      ["metric", "A number measured over time, such as requests per second or error rate."],
      ["trace", "A record of one request's path through many services, with the time spent at each step."],
      ["SLO", "A target for how well a service should perform, measured over a period."],
      ["error budget", "The amount of failure an SLO allows before the target is missed."],
      ["least privilege", "Giving each person or service only the access it needs and nothing more."],
    ],
    walkthrough: {
      title: "Follow a checkout slowdown from alert to fix",
      steps: [
        { label: "Instrument", text: "Each checkout request gets a trace ID that is passed to every service and written in every log line, with metrics for errors and slow responses." },
        { label: "Alert on the symptom", text: "More than 1 per cent of checkouts fail for five minutes. The alert fires because users are affected, not because a CPU is busy." },
        { label: "Diagnose", text: "A trace for a failed checkout shows 9 of its 10 seconds spent waiting on the payment service, which narrows the search at once." },
        { label: "Recover and learn", text: "The team rolls back the last release, confirms errors drop, and writes down what changed so a check can catch it earlier next time." },
      ],
    },
    example: {
      title: "Worked example: what an SLO allows",
      text: "A service has an SLO of 99.9 per cent successful requests over 30 days. With 10 million requests in the month, 0.1 per cent is 10,000 failed requests the team may \"spend\". A bad release that fails 6,000 requests uses 60 per cent of the budget at once, so the team slows risky changes and focuses on reliability for the rest of the month. If the budget is barely touched, they can release faster. Meanwhile, the same team limits what logs record, never writing card numbers or passwords, and tests restoring last night's backup into a clean database every month.",
    },
    tradeoff: {
      title: "Seeing and protecting costs effort",
      gain: {
        label: "You gain",
        items: [
          "Faster diagnosis, because traces and logs show where it hurts",
          "Clear targets that guide when to release and when to fix",
          "Smaller harm from mistakes and attacks, through limited access and tested recovery",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Storing metrics, logs and traces costs money and engineering time",
          "More alerts mean more noise unless they are chosen carefully",
          "Tighter security and regular restore drills slow some work down",
        ],
      },
    },
    pitfalls: [
      "Alerting on every internal metric until operators ignore the noise.",
      "Writing personal or secret data into logs, which then spread to many places.",
      "Taking backups but never trying to restore one until the day it is needed.",
    ],
    remember: [
      "Metrics show trends, logs explain events, traces connect services.",
      "Alert on what users feel and tie each alert to a response.",
      "An SLO is a number you can spend and track.",
      "Test your restore, not just your backup.",
    ],
    interview: [
      "Finish a design by naming dashboards, trace IDs, how data is protected and one failure you have rehearsed.",
      "Pick one or two SLOs for the product and say what you would do when the error budget is nearly spent.",
    ],
    quizzes: [
      {
        question: "Which alert is the best one to wake an engineer at night?",
        options: [
          "One server's disk is 70 per cent full",
          "Over 1 per cent of checkouts fail for 5 minutes",
          "A background job started a little later than usual",
          "Memory use on one machine rose slightly",
        ],
        answer: 1,
        why: "Failing checkouts directly harm users and need a prompt response. The others are internal signals that may matter later but do not justify waking anyone.",
      },
      {
        question: "A service has an SLO of 99.9 per cent success over a month. A bad release has used most of the error budget in two days. What is a sensible response?",
        options: [
          "Release even faster, to get past the problem quickly",
          "Remove the SLO, since it has now been missed",
          "Slow risky changes and put effort into reliability",
          "Delete the logs so that the failures are not seen",
        ],
        answer: 2,
        why: "The error budget exists to guide this choice. When most of it is gone, reliability work takes priority over new risk until the budget recovers.",
      },
      {
        question: "A team has taken a nightly database backup for two years but has never restored one. What is the main risk?",
        options: [
          "Backups may be unusable, and nobody would know",
          "The backups will use too much money to store",
          "The backups are certain to be perfectly valid",
          "The database will refuse to make further backups",
        ],
        answer: 0,
        why: "A backup proves its worth only when restored. Problems such as missing files or wrong settings appear during a restore test, and finding them during a real incident is far too late.",
      },
    ],
  },
];
