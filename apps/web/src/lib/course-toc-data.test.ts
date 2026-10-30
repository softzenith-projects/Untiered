import { describe, expect, it } from "vitest";

import type { Course } from "@/content/courses/types";
import { toCourseTocData } from "@/lib/course-toc-data";

describe("toCourseTocData", () => {
  it("keeps chapter content out of the client navigation payload", () => {
    const course: Course = {
      slug: "example",
      title: "Example",
      seoTitle: "Example course title",
      seoDescription: "Example course description",
      tagline: "Example course",
      level: "Beginner",
      modules: [
        {
          title: "Module one",
          chapters: [
            {
              slug: "chapter-one",
              title: "Chapter one",
              summary: "Summary that the rail does not need",
              minutes: 10,
              blocks: [{ kind: "p", text: "CONTENT_MARKER_THAT_MUST_NOT_CROSS" }],
            },
          ],
        },
      ],
    };

    const data = toCourseTocData(course);

    expect(data).toEqual({
      slug: "example",
      title: "Example",
      modules: [
        {
          title: "Module one",
          chapters: [{ slug: "chapter-one", title: "Chapter one" }],
        },
      ],
    });
    expect(JSON.stringify(data)).not.toContain("CONTENT_MARKER_THAT_MUST_NOT_CROSS");
    expect(JSON.stringify(data)).not.toContain("summary");
    expect(JSON.stringify(data)).not.toContain("blocks");
  });
});

