import { prisma } from "../lib/prisma.js";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

/** Call when user views a lesson or updates progress. Updates lastAcademyActivityAt and academyStreakDays. */
export async function recordAcademyActivity(userId: string): Promise<{ streakDays: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastAcademyActivityAt: true, academyStreakDays: true },
  });
  const now = new Date();
  if (!user) return { streakDays: 0 };

  let newStreak = user.academyStreakDays;
  const last = user.lastAcademyActivityAt;
  if (!last) {
    newStreak = 1;
  } else {
    const diff = daysDiff(now, last);
    if (diff === 0) {
      // same day, no change to streak
    } else if (diff === 1) {
      newStreak = user.academyStreakDays + 1;
    } else {
      newStreak = 1;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastAcademyActivityAt: now, academyStreakDays: newStreak },
  });
  return { streakDays: newStreak };
}
