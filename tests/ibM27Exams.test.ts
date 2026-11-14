import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_IB_M27_EXAMS,
  getIbM27WindowDays,
  isExamRegisteredForUser,
  getMatchedRolesForExam,
  getFirstExamCountdown,
} from "../src/utils/ibM27Exams";
import { COURSE_ROLES } from "../src/types";
import { getTabFromPathname, getPathFromTab } from "../src/routes";

test("IB M27 window strictly includes only April 15-30 and May 1-19 2027", () => {
  const { aprilSecondHalf, mayFirstHalf, allWindowDays } = getIbM27WindowDays();

  assert.equal(aprilSecondHalf.length, 16, "April second half should have 16 days (15..30)");
  assert.equal(aprilSecondHalf[0].date, "2027-04-15");
  assert.equal(aprilSecondHalf[aprilSecondHalf.length - 1].date, "2027-04-30");

  assert.equal(mayFirstHalf.length, 19, "May first half should have 19 days (1..19)");
  assert.equal(mayFirstHalf[0].date, "2027-05-01");
  assert.equal(mayFirstHalf[mayFirstHalf.length - 1].date, "2027-05-19");

  // Ensure no dates outside April 15-30 or May 1-19 exist
  for (const day of allWindowDays) {
    assert.ok(day.month === 4 || day.month === 5);
    if (day.month === 4) {
      assert.ok(day.dayOfMonth >= 15 && day.dayOfMonth <= 30);
    } else {
      assert.ok(day.dayOfMonth >= 1 && day.dayOfMonth <= 19);
    }
  }

  // May 1, 2027 (Saturday) must have 0 exams (official IB holiday)
  const may1 = mayFirstHalf.find((d) => d.date === "2027-05-01");
  assert.ok(may1);
  assert.equal(may1.exams.length, 0);
  assert.equal(may1.isOfficialHoliday, true);
});

test("Every COURSE_ROLE in KapsApp maps to official IB M27 exam papers", () => {
  for (const role of COURSE_ROLES) {
    const matchedExams = OFFICIAL_IB_M27_EXAMS.filter((exam) =>
      isExamRegisteredForUser(exam, [role.id])
    );
    assert.ok(
      matchedExams.length >= 2,
      `Expected role "${role.id}" (${role.label}) to match at least 2 exam papers, found ${matchedExams.length}`
    );
    const matchedRoleObjs = getMatchedRolesForExam(matchedExams[0], [role.id]);
    assert.equal(matchedRoleObjs[0]?.id, role.id);
  }
});

test("First exam countdown accurately calculates remaining days, hours, minutes, seconds", () => {
  // Exact 10 days, 2 hours, 15 minutes, 30 seconds before 2027-04-23T13:00:00+03:00
  const targetMs = new Date("2027-04-23T13:00:00+03:00").getTime();
  const offsetMs = ((10 * 24 + 2) * 3600 + 15 * 60 + 30) * 1000;
  const simulatedNow = targetMs - offsetMs;

  const countdown = getFirstExamCountdown(simulatedNow);
  assert.equal(countdown.isStarted, false);
  assert.equal(countdown.days, 10);
  assert.equal(countdown.hours, 2);
  assert.equal(countdown.minutes, 15);
  assert.equal(countdown.seconds, 30);
  assert.equal(countdown.firstExam.date, "2027-04-23");

  // Role-filtered first exam countdown (e.g. only physics_hl -> first exam is 2027-04-28 13:00)
  const physicsCountdown = getFirstExamCountdown(
    simulatedNow,
    OFFICIAL_IB_M27_EXAMS,
    ["physics_hl"]
  );
  assert.equal(physicsCountdown.firstExam.date, "2027-04-28");
  assert.ok(physicsCountdown.firstExam.roleIds.includes("physics_hl"));
});

test("Routes resolve /ib-m27-sinavlari and ib-m27 tab bidirectionally", () => {
  assert.deepEqual(getTabFromPathname("/ib-m27-sinavlari"), { tab: "ib-m27" });
  assert.deepEqual(getTabFromPathname("/ib-m27"), { tab: "ib-m27" });
  assert.equal(getPathFromTab("ib-m27"), "/ib-m27-sinavlari");
});
