import { timingSafeEqual } from "node:crypto";

import { dailyQuestionsByDate } from "@/lib/arena/daily-question";
import { featureEnabled } from "@/lib/flags";

export const runtime = "nodejs";

/** Server-to-server content bridge. The API and dashboard use one reviewed selector. */
export async function GET(request: Request) {
  const token = process.env.EMAIL_CONTENT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token || !supplied || !equal(token, supplied)) {
    return new Response(null, { status: 401 });
  }
  if (!featureEnabled("arena")) return new Response(null, { status: 404 });
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(null, { status: 400 });
  }
  const question = dailyQuestionsByDate()[date];
  if (!question) return new Response(null, { status: 404 });
  return Response.json(
    { prompt: question.prompt, options: question.options, context: question.context ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function equal(expected: string, supplied: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
