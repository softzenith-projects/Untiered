import type { ChapterSource } from "@/content/courses/system-design/lesson";

export const foundations: ChapterSource[] = [
  {
    slug: "requirements-first",
    title: "Start With Requirements, Not Boxes",
    summary: "Turn a vague product idea into users, actions, limits and a design target.",
    intro: [
      "Requirements are the answers to a few plain questions: who uses this system, what must they be able to do, and what limits does the design have to respect? They are written down before any component is chosen. A good list is short — often three main actions and two or three limits such as speed or cost.",
      "This matters because a design is only good for a particular job. A system built for ten thousand students checking results once a year looks nothing like one built for a million people chatting all day. If you draw boxes first, you will build something impressive for the wrong problem, and finding that out late is expensive.",
    ],
    analogy: [
      "Plan the trip before choosing the vehicle",
      "A bicycle is excellent for a nearby shop and a poor choice for moving a family across the country. You cannot pick the vehicle until you know how far, how many people and how soon. Architecture works the same way: the journey comes first.",
    ],
    glossary: [
      ["functional requirement", "A thing a user must be able to do, such as upload a file or book a seat."],
      ["quality requirement", "A measurable promise about how well the system works, such as speed, safety or uptime."],
      ["constraint", "A fixed limit the design must live with, such as a budget, a deadline or a law."],
      ["scope", "The work included now, together with what is deliberately left for later."],
    ],
    walkthrough: {
      title: "Follow one vague idea down to a design target",
      steps: [
        { label: "Hear the idea", text: "Someone says: \"Build a portal where students see their exam results.\" That sentence names no numbers, no actions and no limits, so it cannot be designed yet." },
        { label: "Ask who and what", text: "You ask who uses it (students, teachers, parents?) and pick three core actions: publish marks, view one result, download a marksheet. Everything else goes on a \"later\" list." },
        { label: "Find the hard limit", text: "You ask when people use it. Results go out once, and most students check within the first hour. The hard part is a short, huge spike, not steady load." },
        { label: "Write the target", text: "You write one line: \"A result opens within two seconds, even in the first hour after publication.\" Every component you add from now on must help meet it." },
      ],
    },
    example: {
      title: "Worked example: a school-results portal",
      text: "The school has 8,000 students. The three core actions are publish marks, view one result and download a marksheet. Live chat and social sharing are interesting but do not help the main job, so they are out of scope. Because results are published once and nearly everyone checks within an hour, the quality target is that a result opens in under two seconds during that spike. That single sentence already points the design towards cheap, repeated reads of data that rarely changes, and away from anything complicated for writes.",
    },
    tradeoff: {
      title: "What time spent on requirements buys",
      gain: {
        label: "You gain",
        items: [
          "A design in which every part has a reason to exist",
          "A shared definition of done, so you can tell when you are finished",
          "Early warning when two wishes conflict, such as lowest cost and highest uptime",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "A few minutes of questions before anything visible is drawn",
          "Having to say no to ideas that are fun but off-target",
          "Answers that may change later, so the list must be revisited",
        ],
      },
    },
    artifact: {
      kind: "compare",
      title: "Two kinds of requirement",
      columns: [
        { label: "What users do", items: ["Create a document", "Share a link", "Reserve a seat"] },
        { label: "How well it works", items: ["Loads within a target", "Survives a zone failure", "Prevents double booking"] },
      ],
    },
    pitfalls: [
      "Starting with microservices, queues or a favourite database before learning what the system must do.",
      "Accepting a requirement like \"it should be fast\" without asking how fast, for whom and when.",
      "Keeping every idea as a must-have, so there is no scope to cut when time runs short.",
    ],
    remember: [
      "Users and actions first, components second.",
      "Three core actions and two quality limits is a good starting list.",
      "Every box you draw should support a named action or limit.",
      "Write down what is out of scope, too.",
    ],
    interview: [
      "Spend the first minutes asking about users, core actions, traffic shape, data size and the quality that matters most. Interviewers watch for this.",
      "Say your assumptions aloud and invite correction, so the interviewer can steer you before you build in the wrong direction.",
    ],
    quizzes: [
      {
        question: "A teammate opens the design discussion by proposing a message queue and three microservices. What is the best next move?",
        options: [
          "Ask which user actions and limits those components would serve",
          "Approve it, since queues and services make any system scale",
          "Reject it, because small projects should never use services",
          "Pick the database first, then decide about the queue afterwards",
        ],
        answer: 0,
        why: "Components are only justified by the actions and limits they support. Asking what they serve exposes whether the design fits the problem, which is neither automatic approval nor automatic rejection.",
      },
      {
        question: "Which of these is a quality requirement rather than a functional one?",
        options: [
          "Teachers can publish marks for a class",
          "Students can download a marksheet as a PDF",
          "A result opens within two seconds at peak",
          "Parents can view a child's published result",
        ],
        answer: 2,
        why: "A quality requirement says how well something works and can be measured. The others describe actions a user can take, which are functional requirements.",
      },
      {
        question: "Results for 8,000 students go live at 9 a.m. and nearly everyone checks within the hour. What does this tell you about the design?",
        options: [
          "Traffic is steady all day, so average load is what matters",
          "A short, sharp spike is the hard part, not total volume",
          "Writes will dominate, so the database must be write-optimised",
          "Nothing yet, because load cannot be known before building it",
        ],
        answer: 1,
        why: "Knowing when people use a system reveals the real challenge. Here the pain is a brief burst of mostly reads, and that shapes the design far more than the total number of requests in a day.",
      },
    ],
  },
  {
    slug: "functional-and-quality-requirements",
    title: "Functional and Quality Requirements",
    summary: "Tell what a system does apart from how well it must do it.",
    intro: [
      "A functional requirement says what a system can do: submit an assignment, search a course, share a link. A quality requirement says how well it must do it: how quickly, how reliably, how securely, at what cost. You need both to describe a system, and they pull on the design in different ways.",
      "The danger is vague quality words. \"Fast\" and \"reliable\" mean something different to everyone, so two people can both think they have delivered and still disagree. Turning each important quality into a number with a time window gives you something you can test, argue about and trade against another quality.",
    ],
    analogy: [
      "A restaurant menu and its service promise",
      "The menu tells you what you can order. The promise that food arrives warm within twenty minutes tells you how well the restaurant must perform. A restaurant with a great menu and cold food an hour late has met one requirement and failed the other.",
    ],
    glossary: [
      ["capability", "Something a user can do with the product, such as upload or search."],
      ["latency target", "The longest waiting time promised for a chosen share of requests."],
      ["availability target", "The share of time the service should be usable, such as 99.9 per cent."],
      ["measurement window", "The period over which a target is checked, such as a day or a month."],
    ],
    walkthrough: {
      title: "Follow \"students can submit an assignment\"",
      steps: [
        { label: "State the capability", text: "\"Students can submit an assignment.\" This is functional: you can tell whether it works by trying it, but it says nothing about how well." },
        { label: "Add a quality", text: "You ask what a good submission feels like. The answer is quick confirmation, so you write: 95 out of every 100 submissions finish within three seconds." },
        { label: "Fix the window", text: "You choose to measure this over each day. Without a window, one slow afternoon could hide inside a good month, or the reverse." },
        { label: "Check it is testable", text: "Two people could now independently look at the numbers and agree whether the target was met. If they could disagree, the sentence is still too vague." },
      ],
    },
    example: {
      title: "Worked example: submitting an assignment",
      text: "The functional requirement is that a student can upload a file for an assignment. The quality target is that 95 of every 100 submissions finish within three seconds, measured per day. Suppose file storage is briefly slow at 11:55 p.m. before a deadline. The system can accept the file, show \"processing\" and finish saving a few seconds later. The student has been told honestly, the upload is not lost, and the three-second promise is kept for the confirmation even though the final save took longer. A number turned a vague wish into a design choice.",
    },
    tradeoff: {
      title: "What measurable targets buy and cost",
      gain: {
        label: "You gain",
        items: [
          "Agreement on when the system is good enough",
          "A way to compare options, such as whether a cache is worth its cost",
          "Alerts that mean something, because they fire against a stated number",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Stricter targets cost more money and engineering effort",
          "Targets need measuring tools before they can be checked",
          "Improving one quality, such as speed, can weaken another, such as cost",
        ],
      },
    },
    pitfalls: [
      "Calling every requirement a must-have, so there is no way to trade one quality against another.",
      "Writing \"fast\" or \"secure\" with no number, so no one can ever say it failed.",
      "Listing qualities that sound good but do not drive any design choice for this product.",
    ],
    remember: [
      "Functional is what; quality is how well.",
      "Turn vague words into a number with a time window.",
      "Two people should be able to decide independently if a target was met.",
      "Pick the two qualities that shape the design and say the rest are secondary.",
    ],
    interview: [
      "Name the two qualities that drive the architecture for this product and explain why the others matter less. This shows you can prioritise.",
      "Put numbers on them, even rough ones, and say what you would give up to protect them.",
    ],
    quizzes: [
      {
        question: "Which sentence is a measurable quality requirement?",
        options: [
          "The upload page should feel quick and friendly",
          "Teachers must be able to upload marks easily",
          "The system must be reliable during exam week",
          "99% of uploads finish in five seconds each day",
        ],
        answer: 3,
        why: "Only this one names a share of requests, a time limit and a measurement period, so two people could check it and agree. The others are opinions that cannot be tested.",
      },
      {
        question: "Every requirement on a list is marked \"must-have\". What problem does this cause?",
        options: [
          "The documentation becomes too long for anyone to read",
          "Developers lose interest in the project over time",
          "Nothing can be traded off when time or money runs short",
          "Quality requirements cannot be written down in numbers",
        ],
        answer: 2,
        why: "Priorities exist so you know what to protect when you cannot have everything. If all items are equally essential, a conflict between two of them has no way to be resolved.",
      },
      {
        question: "A quiz page loads in 1 second for most students but takes 9 seconds for a few. The team's target says \"fast\". What is the real weakness?",
        options: [
          "The word fast has no number, share of requests or time window",
          "One second is far too slow for any web page to count as acceptable",
          "Students with slow connections should never be counted in the targets",
          "The slow cases prove that the whole design is wrong from the start",
        ],
        answer: 0,
        why: "Without a number and a share of requests, nobody can say whether the target was missed. A statement such as 95 per cent within two seconds would separate the common case from the slow tail.",
      },
    ],
  },
  {
    slug: "latency-throughput-and-reliability",
    title: "Latency, Throughput and Reliability",
    summary: "Measure waiting time, work per second and whether the service keeps its promise.",
    intro: [
      "Latency is how long one operation takes from start to finish. Throughput is how many operations the system completes per unit of time. Availability is whether the service works right now, and durability is whether data you saved will still exist later. These four answer different questions, so a system can be strong in one and weak in another.",
      "People often talk about the average, but the average hides the slow requests that unhappy users actually feel. That is why engineers talk about percentiles such as p95, the value that 95 per cent of requests beat. Reliability promises such as \"99.9 per cent available\" sound strict, yet they still allow real downtime, so you have to work out what the number means.",
    ],
    analogy: [
      "A supermarket checkout",
      "How long one shopper waits at the till is latency. How many shoppers all the tills serve per minute is throughput. Whether a till is open when the board says it will be is availability. A shop can serve many people per minute and still keep a few of them waiting a very long time.",
    ],
    glossary: [
      ["latency", "The time one operation takes to finish, measured for a single request."],
      ["throughput", "The number of operations completed per unit of time, such as requests per second."],
      ["p95", "A value that 95 per cent of measured requests are at or below, which exposes the slow tail."],
      ["availability", "The share of time the service is usable when someone tries it."],
      ["durability", "The promise that data once confirmed as saved will survive later failures."],
    ],
    walkthrough: {
      title: "Follow a minute of checkout traffic",
      steps: [
        { label: "Count the work", text: "In one minute the checkout completes 600 purchases. That is 600 divided by 60, so the throughput is 10 purchases per second." },
        { label: "Time each request", text: "Most purchases finish in about 300 milliseconds. The slowest 5 per cent take around 1.8 seconds because they wait on a payment provider." },
        { label: "Pick the right summary", text: "The average looks fine at roughly 370 ms, but p95 shows 1.8 seconds. The p95 describes what the unluckiest shoppers experience." },
        { label: "Separate the promises", text: "A crash happens. Availability asks whether checkout worked during the outage; durability asks whether confirmed orders were still there afterwards." },
      ],
    },
    example: {
      title: "Worked example: what 99.9 per cent allows",
      text: "A service promises 99.9 per cent availability over a 30-day month. A month has 43,200 minutes, and 0.1 per cent of that is about 43 minutes of allowed downtime. At 99 per cent, the allowance is 432 minutes, over seven hours. Going from 99 to 99.9 sounds like a small step but it cuts permitted downtime by ten times, and it usually costs far more in redundancy and engineering. Durability is separate: a service could be down for the whole 43 minutes and still not have lost a single saved order.",
    },
    tradeoff: {
      title: "Chasing each measure costs something",
      gain: {
        label: "You gain",
        items: [
          "Lower latency makes pages feel instant and keeps users engaged",
          "Higher throughput lets the same hardware serve more people",
          "Higher availability and durability build trust in the service",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Cutting tail latency often needs caches, extra copies and more money",
          "Batching work raises throughput but can make each request wait longer",
          "Each extra nine of availability needs redundancy and more operations effort",
        ],
      },
    },
    pitfalls: [
      "Reporting only the average, which hides the slow requests that users complain about.",
      "Treating 99 per cent availability as nearly perfect when it still allows several hours of downtime a month.",
      "Mixing up availability with durability, and assuming a service that stayed up cannot have lost data.",
    ],
    remember: [
      "Latency is for one request; throughput is for many per second.",
      "Report a percentile such as p95, not only the average.",
      "Availability asks \"can I use it now?\"; durability asks \"will my data survive?\"",
      "Every extra nine of uptime costs much more than the last.",
    ],
    interview: [
      "Turn a product promise into a measurable target, such as 95 per cent of searches under 300 ms, and say what it would cost.",
      "Check peak traffic and tail latency in your design, not just the daily average.",
    ],
    quizzes: [
      {
        question: "A service has a 200 ms average response time, but users complain about long waits. What should you check first?",
        options: [
          "The p95 or p99, which show how slow the slowest requests are",
          "The throughput, because a high average always means low volume",
          "The durability, since waiting means the data may be lost",
          "Nothing, because a 200 ms average is within any normal target",
        ],
        answer: 0,
        why: "An average can look healthy while a small share of requests are very slow. A high percentile exposes that tail, which is what the complaining users are experiencing.",
      },
      {
        question: "A database crashes and restarts. For ten minutes the app shows errors, but afterwards every order from before the crash is still there. What happened?",
        options: [
          "Availability dropped, but durability held",
          "Durability failed, but availability held",
          "Both availability and durability failed completely",
          "Neither was affected, because the service came back",
        ],
        answer: 0,
        why: "Users could not use the service for ten minutes, which is lost availability. Saved data survived, which is durability doing its job. The two are different promises.",
      },
      {
        question: "A shop completes 1,200 orders in two minutes. What is its throughput?",
        options: [
          "1,200 orders per second",
          "10 orders per second",
          "20 orders per second",
          "2,400 orders per second",
        ],
        answer: 1,
        why: "Two minutes is 120 seconds, and 1,200 divided by 120 is 10 orders per second. Throughput is work completed divided by the time taken.",
      },
    ],
  },
  {
    slug: "back-of-the-envelope-estimation",
    title: "Back-of-the-Envelope Estimation",
    summary: "Estimate requests, storage and bandwidth well enough to expose the real bottleneck.",
    intro: [
      "Estimation means working out rough sizes with simple arithmetic: how many requests per second, how many bytes stored per day, how much data sent out. You use round numbers, keep the unit next to every figure, and aim for the right order of magnitude — tens, thousands or millions — not a precise answer.",
      "It matters because the numbers choose the design. A hundred requests per second fits on one small server. A hundred thousand does not. A rough estimate tells you early which part will hurt first, so you can spend your effort there. The danger is false precision: a number with five digits that rests on an assumption nobody stated.",
    ],
    analogy: [
      "Packing water for a trek",
      "You do not need to count the sips. People times hours times rough consumption tells you whether to carry two bottles or arrange a water tanker. Being off by ten per cent hardly matters; being off by ten times changes the whole plan.",
    ],
    glossary: [
      ["QPS", "Queries or requests handled per second, the usual measure of traffic."],
      ["peak traffic", "The busiest expected period, which the system must survive, rather than the daily average."],
      ["retention", "How long stored data must be kept before it can be deleted."],
      ["order of magnitude", "A rough scale such as hundreds, thousands or millions, which is what an estimate aims for."],
    ],
    walkthrough: {
      title: "Estimate a feed's read traffic step by step",
      steps: [
        { label: "State assumptions", text: "Assume 1 million users, and that each opens their feed 10 times a day. Write both numbers down so anyone can correct them." },
        { label: "Find the daily total", text: "1 million times 10 is 10 million feed reads per day." },
        { label: "Convert to per second", text: "A day has about 100,000 seconds (86,400, rounded), so 10 million divided by 100,000 is roughly 100 requests per second on average. Careful rounding gives about 116." },
        { label: "Apply a peak factor", text: "Traffic is not flat. Assume the peak is ten times the average, so plan for roughly 1,200 reads per second and check whether one server could handle that." },
      ],
    },
    example: {
      title: "Worked example: storing uploaded photos",
      text: "Suppose 200,000 people each upload 2 photos a day, and each photo is about 2 MB after compression. That is 400,000 photos a day, or 800,000 MB, roughly 800 GB per day. Kept for one year, that is about 290 TB, so storage cost and the choice of object storage matter right away. Now vary one assumption: if photos are kept only 30 days, the total is around 24 TB, over ten times smaller. That sensitivity check shows retention is the number to confirm with the product owner, because it changes the answer far more than the exact photo size does.",
    },
    tradeoff: {
      title: "Quick estimates against careful measurement",
      gain: {
        label: "You gain",
        items: [
          "An early view of the likely bottleneck before anything is built",
          "A shared set of stated assumptions that others can challenge",
          "Quick elimination of designs that clearly cannot cope",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Rough inputs mean the result can be wrong by a large factor",
          "Round numbers hide detail such as uneven usage across the day",
          "Over-trusting a neat answer can stop people from measuring real traffic",
        ],
      },
    },
    pitfalls: [
      "Giving a precise-looking number such as 117,284 requests per second from assumptions that were never said aloud.",
      "Designing for the daily average when the real danger is a peak several times higher.",
      "Mixing units, such as bits with bytes or megabytes with gigabytes, and being off by a factor of eight or a thousand.",
    ],
    remember: [
      "State assumptions first, then calculate.",
      "Keep units next to every number.",
      "Round hard and aim for the order of magnitude.",
      "Always ask what changes if the uncertain assumption is ten times bigger.",
    ],
    interview: [
      "Estimate aloud, invite correction, and then connect the result to a decision such as whether to partition data or add a cache.",
      "Show a sensitivity check on the assumption you trust least. It matters more than extra decimal places.",
    ],
    quizzes: [
      {
        question: "A feed gets 10 million reads a day, with peak traffic about ten times the average. Which figure should the design aim to handle?",
        options: [
          "About 100 requests per second, the daily average",
          "About 1,000 requests per second, the estimated peak",
          "About 10 million requests per second, the daily total",
          "About 10 requests per second, the number of users",
        ],
        answer: 1,
        why: "Average load is roughly 100 per second, and a ten times peak makes it around 1,000. A system that handles only the average fails exactly when the most people are using it.",
      },
      {
        question: "Your storage estimate says 290 TB for a year of photos. The product owner now says photos are deleted after 30 days. What is the best response?",
        options: [
          "Keep the 290 TB figure, because a larger plan is always the safer one",
          "Round the new total up to 290 TB anyway to keep the plan simple",
          "Recalculate, since retention changed the answer by over ten times",
          "Ignore it, because retention rarely has any effect on storage size",
        ],
        answer: 2,
        why: "Retention multiplies directly into stored volume. Going from a year to 30 days shrinks the total about twelve times, which could change the storage choice and cost. Recomputing shows which assumption matters.",
      },
      {
        question: "Which statement is the best way to present an estimate in a design discussion?",
        options: [
          "\"The exact answer is 117,284 requests per second, no doubt.\"",
          "\"With 1 million users opening it 10 times, about 100 per second.\"",
          "\"It will definitely need a hundred servers.\"",
          "\"Estimates are unreliable, so we should simply build it and see.\"",
        ],
        answer: 1,
        why: "A good estimate names its assumptions, uses round numbers and states an order of magnitude. Others can then correct the assumptions, which is the real point of estimating.",
      },
    ],
  },
  {
    slug: "journey-of-a-request",
    title: "The Journey of a Request",
    summary: "Follow one click through DNS, the network, an application and storage.",
    intro: [
      "When you tap a link, a chain of steps runs before anything appears. Your browser turns a name into an address, opens a secure connection, sends a request, and waits for a response. In between, the request may pass a proxy, a load balancer, an application service, a cache and a database.",
      "Knowing this chain matters because every step is a place where time is spent or something can fail. If a page is slow, the problem is at one step, and you cannot find it without knowing the steps. Most system design questions are really questions about where to place a cache, a copy or a safety check along this path.",
    ],
    analogy: [
      "A parcel with several sorting stops",
      "A parcel goes from a local pickup point through sorting centres to the destination, and a reply travels back the same way. A delay at any stop slows the whole delivery. A web request similarly crosses name lookup, networks and services before a response returns.",
    ],
    glossary: [
      ["DNS", "The directory that turns a domain name such as example.com into a network address."],
      ["TLS", "The encryption and identity checking that make a connection safe, shown as the padlock in a browser."],
      ["HTTP request", "A structured message asking a server to do something, such as fetch a page."],
      ["network hop", "One boundary a request crosses between two components, where time can be lost or a failure can occur."],
    ],
    walkthrough: {
      title: "Follow a learner opening a lesson",
      steps: [
        { label: "Find the address", text: "The browser asks DNS for the address behind the site's name. The answer is often saved for a while, so repeat visits skip this step." },
        { label: "Connect securely", text: "The browser opens a connection to that address and agrees encryption with TLS, so nobody on the network can read or change the traffic." },
        { label: "Reach the service", text: "An edge proxy receives the HTTP request and passes it to a lesson service. The service checks that this learner is enrolled." },
        { label: "Read and respond", text: "The service reads lesson details from a cache, or from the database if the cache misses, and returns the response along the same path in reverse." },
      ],
    },
    example: {
      title: "Worked example: where the 800 ms went",
      text: "A lesson page takes 800 ms to open. Tracing one request shows roughly 20 ms for name lookup, 60 ms to set up the secure connection, 30 ms in the proxy, 90 ms in the service's own code, and 600 ms waiting for one slow database query. Without the trace, a team might spend a week tuning the proxy. With it, they see that nearly three quarters of the time is one query, so an index or a cache on that query is the fix. Every hop also needs a timeout: if the database never answers, the service should give up after a set time rather than hold the learner's request open forever.",
    },
    tradeoff: {
      title: "More hops, more power and more risk",
      gain: {
        label: "You gain",
        items: [
          "Each layer can do one job well, such as security, routing or storage",
          "Layers can be scaled, replaced or cached independently",
          "A single traced request shows exactly where time goes",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Every extra hop adds waiting time and one more thing that can fail",
          "Timeouts and retries must be set at each boundary",
          "Problems can hide between components, making them harder to find",
        ],
      },
    },
    pitfalls: [
      "Drawing arrows between boxes without saying what protocol or data crosses them.",
      "Forgetting timeouts, so one stuck database call holds up requests all the way back to the user.",
      "Assuming the first component in the path is the slow one, instead of measuring each step.",
    ],
    remember: [
      "A request crosses name lookup, a secure connection, a proxy, a service and storage.",
      "Every hop costs time and can fail.",
      "Trace one request before you multiply the system into many services.",
      "Put a timeout on every network call.",
    ],
    interview: [
      "Walk one request from the browser to the database and back, then point to where latency, security checks and single points of failure sit.",
      "Say what crosses each arrow: the protocol, the data and how long you would wait before giving up.",
    ],
    quizzes: [
      {
        question: "A page takes 800 ms, and a trace shows 600 ms is one database query. Where should the team work first?",
        options: [
          "On the load balancer, since it sees every request first",
          "On that query, using an index or a cache",
          "On the DNS lookup, since it always happens first",
          "On the browser, since the user's device is slowest",
        ],
        answer: 1,
        why: "The trace shows where the time is actually spent. Improving a step that takes a small share of the total cannot fix a page that is slow mainly because of one query.",
      },
      {
        question: "A service calls a database that has stopped responding, and there is no timeout. What is the likely result?",
        options: [
          "The call fails at once and the user sees a clear and friendly error",
          "The database restarts itself once the call has waited long enough",
          "Requests pile up waiting, and the service itself becomes slow",
          "The proxy automatically answers from its own saved copy of the data",
        ],
        answer: 2,
        why: "Without a timeout the service keeps waiting, so threads and connections fill with requests that cannot finish. The failure of one dependency spreads upwards to the caller.",
      },
      {
        question: "What does TLS add to the journey of a request?",
        options: [
          "It makes the response arrive faster than it would otherwise",
          "It stores a copy of the page close to the user",
          "It converts the domain name into a network address",
          "It encrypts the connection and confirms the server",
        ],
        answer: 3,
        why: "TLS protects the connection from being read or altered, and it checks the server's identity. Finding an address is DNS, and keeping copies near users is caching.",
      },
    ],
  },
  {
    slug: "api-contracts-and-idempotency",
    title: "API Contracts and Idempotency",
    summary: "Design interfaces that remain safe when clients retry and datasets grow.",
    intro: [
      "An API contract is the agreement between a client and a server: what a request looks like, what a response looks like, and what errors can come back. Good contracts also cover large lists through pagination, and changes over time through versioning, so existing apps do not break when the server improves.",
      "The tricky part is retries. Networks lose messages, and a client that gets no answer cannot tell whether the server did the work or never received the request. If it simply tries again, a payment can be taken twice. Idempotency solves this by making a repeated request safe: doing it again gives the same result as doing it once.",
    ],
    analogy: [
      "A numbered token at a service desk",
      "You hand in a form and get token 82. If you walk back and show the same token, the staff recognise it and tell you the result instead of processing the form again. The token turns \"is this a new order?\" into a question the desk can answer.",
    ],
    glossary: [
      ["API contract", "The agreed shapes of requests, responses and errors between a client and a server."],
      ["idempotency", "The property that repeating the same operation has no further effect beyond the first time."],
      ["idempotency key", "A unique value the client attaches to a request so the server can recognise a repeat."],
      ["pagination", "Returning a large list in bounded pages instead of all at once."],
      ["versioning", "Changing an interface without silently breaking clients that rely on the old one."],
    ],
    walkthrough: {
      title: "Follow a checkout that is retried",
      steps: [
        { label: "Send with a key", text: "The app sends `POST /orders` with the idempotency key `checkout-82` and the cart contents." },
        { label: "Do the work once", text: "The server sees the key for the first time, creates order 941, charges the card and saves the result against that key." },
        { label: "The reply is lost", text: "The response never reaches the phone because the signal drops. The app does not know if the order exists, so it sends the same request again." },
        { label: "Recognise the repeat", text: "The server finds `checkout-82` in its saved results and returns order 941 again, with no second charge and no second order." },
      ],
    },
    example: {
      title: "Worked example: paging through 50,000 orders",
      text: "A support tool lists orders. Returning all 50,000 at once would be slow and could crash the page, so the API returns 50 at a time with a cursor, a marker that says where the next page starts. The first call is `GET /orders?limit=50`, and the response includes `next_cursor`. The tool passes that cursor to fetch the following 50. A cursor holds up better than page numbers, because if new orders arrive while someone is paging, page numbers shift and rows are skipped or repeated. The stored result for an idempotency key, by contrast, only needs to be kept briefly, perhaps a day, since retries come soon after the first attempt.",
    },
    tradeoff: {
      title: "What a careful contract buys and costs",
      gain: {
        label: "You gain",
        items: [
          "Safe retries, so a network glitch never charges anyone twice",
          "Bounded work per request, which keeps responses quick",
          "Old clients keep working while the server evolves",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "The server must store keys and results, and clear them eventually",
          "Clients must generate keys and send them correctly",
          "Supporting several versions at once adds testing and maintenance",
        ],
      },
    },
    pitfalls: [
      "Retrying a payment-like write blindly, so the action is created twice.",
      "Returning an unbounded list, which works with ten rows in testing and fails with a million in production.",
      "Changing a field name or meaning in an existing version, so older clients break without warning.",
    ],
    remember: [
      "A retry should be safe, not scary.",
      "Writes with side effects need an idempotency key.",
      "Always bound a list with a limit and a cursor.",
      "Describe errors as carefully as successes.",
    ],
    interview: [
      "Give success and error shapes, retry behaviour, pagination and compatibility, not just endpoint names.",
      "Point at the one write that could cause harm if repeated, such as payment, and show how its key makes the retry safe.",
    ],
    quizzes: [
      {
        question: "A client sends a payment, and the connection drops before the reply arrives. What should the client do?",
        options: [
          "Retry with the same idempotency key, so the server can recognise the repeat",
          "Retry with a brand-new key, so the server treats it as a fresh order",
          "Never retry, since the server must surely have failed to process it",
          "Wait a full day, since the server needs that time to finish processing",
        ],
        answer: 0,
        why: "The client cannot know whether the payment happened. Reusing the same key lets the server return the earlier result instead of charging again, whereas a new key would look like a second payment.",
      },
      {
        question: "Which operation is naturally idempotent?",
        options: [
          "Adding 100 rupees to the balance of a wallet",
          "Appending one more new line to the end of a log",
          "Creating a brand-new order each time a call is made",
          "Setting a user's display name to a given value",
        ],
        answer: 3,
        why: "Setting a field to a fixed value gives the same state however many times you do it. Adding, appending and creating all change the outcome with each repeat.",
      },
      {
        question: "An orders API returns every order in one response. It worked in testing with 20 rows but fails in production with 2 million. What is the fix?",
        options: [
          "Buy a much larger server so the full list always fits in memory",
          "Return the list in bounded pages with a limit and a cursor",
          "Tell every client to download the whole list only during the night",
          "Compress the response so that the whole list becomes much smaller",
        ],
        answer: 1,
        why: "The problem is unbounded work per request. Pagination limits how much each call does, whereas more hardware or compression only postpones the same failure.",
      },
    ],
  },
  {
    slug: "data-models-from-access-patterns",
    title: "Model Data From Access Patterns",
    summary: "Shape data around the questions the product asks most often.",
    intro: [
      "A data model lists what the system stores — users, classes, assignments, orders — how those things relate, and how each one is found. The most useful way to build it is to start from the questions the product asks most often and the changes it makes most often, and shape the tables or documents to answer them quickly.",
      "This order matters because a database can make some questions cheap and others painfully slow. If you pick the tables first and discover the main screen needs a slow search across all of them, you must redesign under pressure. Writing the top reads and writes first lets you choose keys and indexes that make the common paths fast.",
    ],
    analogy: [
      "Arrange a kitchen for the meals you cook",
      "A spice you use every day belongs near the stove, and a festival dish can live on a high shelf. You arrange the kitchen by how often you reach for things and what you use together. A data model follows access frequency and grouping in just the same way.",
    ],
    glossary: [
      ["entity", "A thing the system stores information about, such as a class, a student or an assignment."],
      ["access pattern", "A frequent way the product reads or changes data, such as listing a class's assignments by due date."],
      ["primary key", "A value that uniquely identifies one stored record."],
      ["normalisation", "Keeping each fact in one authoritative place so copies cannot disagree."],
    ],
    walkthrough: {
      title: "Follow a classroom app from questions to keys",
      steps: [
        { label: "List the hot reads", text: "Teachers most often ask: \"show all assignments in class 12, ordered by due date.\" Students most often ask: \"show my submissions.\"" },
        { label: "Name the entities", text: "You identify classes, assignments and submissions, and decide who owns each. A submission belongs to one student and one assignment." },
        { label: "Choose the keys", text: "Assignments are looked up by class, so the key starts with `class_id`. An index on `(class_id, due_date)` returns them already in order." },
        { label: "Check each write", text: "You trace the write when a student submits: it creates one submission row and touches nothing else, so it stays fast even in a busy class." },
      ],
    },
    example: {
      title: "Worked example: showing assignments with a submission count",
      text: "The teacher's screen lists 30 assignments, each with how many students have submitted. Counting submissions by scanning the table on every view would get slower as data grows. Two choices exist. Keep data fully normalised and count on demand, which is always correct but costs a query per assignment. Or store a `submission_count` on each assignment and add one to it whenever a submission arrives, which is much faster to read but now two places hold related facts. Because this screen is opened constantly and a count that is a second behind is acceptable, the stored count is justified. A rarely used report would not earn that duplication.",
    },
    tradeoff: {
      title: "Normalised data against copies made for speed",
      gain: {
        label: "You gain",
        items: [
          "Normalised data keeps one fact in one place, so it stays consistent",
          "Duplicated fields make a proven hot read cheap and simple",
          "Designing from access patterns avoids slow surprises later",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Normalised data may need joins that cost time on hot paths",
          "Every duplicated copy must be updated or it drifts out of date",
          "A model tuned for today's questions can make tomorrow's questions awkward",
        ],
      },
    },
    pitfalls: [
      "Choosing a database category first and forcing the data to fit it.",
      "Duplicating data everywhere \"for speed\" before measuring a slow read, then fighting out-of-date copies.",
      "Forgetting ownership and deletion, so nobody knows whose data a row is or how to remove it.",
    ],
    remember: [
      "Write the top reads and writes before the tables.",
      "The key you choose decides which queries are cheap.",
      "Duplicate data only for a read you have proven is hot.",
      "Every row needs an owner and a plan for deletion.",
    ],
    interview: [
      "Walk through one write and two important reads using concrete keys and field names. This is more convincing than naming a database.",
      "Say where you duplicated data on purpose and how you keep that copy correct.",
    ],
    quizzes: [
      {
        question: "A product's main screen always shows a user's ten latest notifications. How should this shape the data model?",
        options: [
          "Store all notifications in one table with no particular key",
          "Pick a key and index that fetch one user's newest rows",
          "Wait until the table is slow, then choose a faster database",
          "Copy each notification into every other table as well",
        ],
        answer: 1,
        why: "The main read is known, so the key and index should be designed to answer it directly. Leaving it until things are slow, or copying data everywhere, ignores the access pattern.",
      },
      {
        question: "A team stores a student's name in the students table and also in every submission row. A student changes their name. What is the main risk?",
        options: [
          "Old submission rows may keep showing the previous name",
          "The students table will refuse to accept the update",
          "The database will automatically delete all duplicates",
          "Reads of submissions will immediately become much slower",
        ],
        answer: 0,
        why: "Duplicated data must be updated in every place. If only the students table changes, the copies drift out of date and the system disagrees with itself.",
      },
      {
        question: "When is it reasonable to store a duplicated count, such as submissions per assignment, instead of counting every time?",
        options: [
          "Never, because normalised data is always the better design",
          "Whenever a developer feels the database might one day be slow",
          "Only for tables with fewer than ten rows in total",
          "When a hot read needs it and slight staleness is acceptable",
        ],
        answer: 3,
        why: "Duplication is a trade: faster reads against the work of keeping the copy right. It pays off when a proven hot read can tolerate a small delay in accuracy.",
      },
    ],
  },
  {
    slug: "a-repeatable-design-method",
    title: "A Repeatable Design Method",
    summary: "Use one calm sequence from requirements to bottlenecks and trade-offs.",
    intro: [
      "A design method is a fixed order in which you work through a problem: clarify scope, estimate scale, define the interfaces and data, draw a simple version, then deepen the riskiest parts. Finish by checking failures, monitoring, security and the trade-offs you made. You can loop back whenever a new fact appears.",
      "Under pressure, people jump straight to clever components and forget basic questions. A method protects you from that, in an interview and in real work. It also lets other people follow your thinking and step in early, before you spend twenty minutes perfecting a part that does not matter.",
    ],
    analogy: [
      "A pilot's checklist",
      "Experienced pilots still use a checklist before take-off, not because they forgot how to fly, but because pressure makes anyone skip basics. A design discussion deserves the same protection: a short list that you follow even when you feel sure.",
    ],
    glossary: [
      ["high-level design", "The small set of major components and the paths requests take between them."],
      ["bottleneck", "The resource that reaches its limit first and holds back the whole system."],
      ["trade-off", "A benefit gained by accepting a cost somewhere else."],
      ["failure mode", "A specific way the system can stop meeting its promise, such as a database going down."],
    ],
    walkthrough: {
      title: "Follow a photo-sharing prompt through the method",
      steps: [
        { label: "Scope and scale", text: "You choose three actions: upload, view and delete a photo. You estimate daily uploads and views and note that views will far outnumber uploads." },
        { label: "Interfaces and data", text: "You sketch `POST /photos` and `GET /photos/{id}`, and decide that photo bytes go to object storage while metadata sits in a database." },
        { label: "Simple design", text: "You draw client, API, storage and a CDN, then trace one upload and one view to make sure the whole flow works." },
        { label: "Deepen and stress", text: "Views dominate, so you add caching. Then you ask what fails: if storage is down, uploads are refused with a clear error; deletion must remove the bytes as well as the row." },
      ],
    },
    example: {
      title: "Worked example: spending forty minutes",
      text: "In a forty-minute design discussion, a balanced split might be about five minutes on scope, five on estimates, ten on interfaces, data and a simple diagram, fifteen on the riskiest part, and five on failures and trade-offs. Suppose halfway through you learn the system is mainly read-heavy. You loop back, adjust your estimate and move caching up in importance. A candidate with no method might spend thirty minutes naming databases and have no time left to check whether the finished design actually serves the opening requirements. The method is not a script; it is a way to keep time and attention on what matters.",
    },
    tradeoff: {
      title: "Following a method has costs, too",
      gain: {
        label: "You gain",
        items: [
          "Calm, steady progress even when the problem is unfamiliar",
          "Early chances for others to redirect you cheaply",
          "A final check that the design still matches the opening requirements",
        ],
      },
      cost: {
        label: "You pay",
        items: [
          "Rigid following can waste time on steps this problem does not need",
          "The simple first design may feel too basic and tempt you to skip ahead",
          "Looping back when facts change costs extra time",
        ],
      },
    },
    pitfalls: [
      "Spending most of the time naming components and none validating the complete flow end to end.",
      "Deepening a part that is easy and interesting instead of the one that carries the most risk.",
      "Never returning to the opening requirements to check the finished design still meets them.",
    ],
    remember: [
      "Scope, scale, interfaces and data, simple design, then deepen.",
      "Trace one full request before adding detail.",
      "Spend depth where the risk is.",
      "Finish with failures, security and honest trade-offs.",
    ],
    interview: [
      "Narrate the method aloud so the interviewer can redirect you before you invest in the wrong branch.",
      "End by comparing the final design with the requirements you wrote at the start and naming one trade-off you accepted.",
    ],
    quizzes: [
      {
        question: "Halfway through a discussion you learn that reads will outnumber writes a hundred to one. What does the method suggest?",
        options: [
          "Keep going exactly as planned, since changing plans wastes time",
          "Restart the discussion from nothing and ignore the earlier work",
          "Ignore it, because read and write ratios do not affect design",
          "Loop back, revise the estimate and give caching more attention",
        ],
        answer: 3,
        why: "The method allows looping back when new facts arrive. A strongly read-heavy workload changes where the risk is, so the estimate and priorities should be updated rather than ignored or thrown away.",
      },
      {
        question: "Why draw a simple end-to-end design before going deep on any one component?",
        options: [
          "It proves the whole flow works before effort is spent on detail",
          "It lets you avoid discussing failures and trade-offs altogether",
          "It guarantees that the first drawing is the final design",
          "It is only a formality that interviewers expect to see",
        ],
        answer: 0,
        why: "A simple full path shows whether the pieces fit together. Detail added to a part of a design that does not connect to the rest is wasted effort.",
      },
      {
        question: "A candidate spends thirty minutes comparing database brands and has five minutes left. What went wrong?",
        options: [
          "They covered too many failure modes in the available time",
          "They spent depth on a detail, not on the riskiest part of the design",
          "They estimated the scale too carefully before choosing components",
          "They asked too many questions about the original requirements",
        ],
        answer: 1,
        why: "Time should go where the risk is. Debating a detail at length left no room to validate the whole flow, failures and trade-offs, which the method asks for.",
      },
    ],
  },
];
