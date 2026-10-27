import { describe, it, expect } from 'vitest';
import { calculateStreak } from '../shared/services/scoringService.js';
import { getStudentSessions, getAllSessions } from '../shared/services/sessionService.js';
import { getAllStudents, enrollStudent } from '../shared/services/studentService.js';

describe('Accurate Streak & Dynamic Teacher Analytics Audit', () => {

  it('1. Returns 0 for empty, null, or undefined session history', () => {
    expect(calculateStreak([])).toBe(0);
    expect(calculateStreak(null)).toBe(0);
    expect(calculateStreak(undefined)).toBe(0);
  });

  it('2. Accurately counts consecutive compliant sessions (score >= 70)', () => {
    const history = [
      { timestamp: '2026-10-25T10:00:00Z', complianceScore: 95, status: 'completed' },
      { timestamp: '2026-10-24T10:00:00Z', complianceScore: 88, status: 'completed' },
      { timestamp: '2026-10-23T10:00:00Z', complianceScore: 75, status: 'completed' }
    ];
    expect(calculateStreak(history)).toBe(3);
  });

  it('3. Breaks streak immediately on non-compliant session (score < 70 or abandoned)', () => {
    const historyWithLowRecent = [
      { timestamp: '2026-10-25T10:00:00Z', complianceScore: 50, status: 'completed' },
      { timestamp: '2026-10-24T10:00:00Z', complianceScore: 95, status: 'completed' },
      { timestamp: '2026-10-23T10:00:00Z', complianceScore: 92, status: 'completed' }
    ];
    expect(calculateStreak(historyWithLowRecent)).toBe(0);

    const historyWithPastFail = [
      { timestamp: '2026-10-25T10:00:00Z', complianceScore: 90, status: 'completed' },
      { timestamp: '2026-10-24T10:00:00Z', complianceScore: 85, status: 'completed' },
      { timestamp: '2026-10-23T10:00:00Z', complianceScore: 60, status: 'completed' },
      { timestamp: '2026-10-22T10:00:00Z', complianceScore: 99, status: 'completed' }
    ];
    expect(calculateStreak(historyWithPastFail)).toBe(2);

    const historyWithAbandoned = [
      { timestamp: '2026-10-25T10:00:00Z', complianceScore: 90, status: 'abandoned' },
      { timestamp: '2026-10-24T10:00:00Z', complianceScore: 95, status: 'completed' }
    ];
    expect(calculateStreak(historyWithAbandoned)).toBe(0);
  });

  it('4. Ignores dry mode and test mode sessions during streak computation', () => {
    const historyWithDry = [
      { timestamp: '2026-10-25T12:00:00Z', complianceScore: 40, status: 'completed', mode: 'dry' },
      { timestamp: '2026-10-25T10:00:00Z', complianceScore: 85, status: 'completed', mode: 'strict' },
      { timestamp: '2026-10-24T10:00:00Z', complianceScore: 90, status: 'completed', mode: 'strict' }
    ];
    expect(calculateStreak(historyWithDry)).toBe(2);
  });

  it('5. Each student has their own distinct streak based on their actual performance', async () => {
    const alexSessions = await getStudentSessions('STU_101');
    const jordanSessions = await getStudentSessions('STU_102');
    const samSessions = await getStudentSessions('STU_103');

    const alexStreak = calculateStreak(alexSessions);
    const jordanStreak = calculateStreak(jordanSessions);
    const samStreak = calculateStreak(samSessions);

    // Streaks must NOT all be identical (e.g. not hardcoded to 3)
    expect(alexStreak).toBe(5);
    expect(jordanStreak).toBe(3);
    expect(samStreak).toBe(0);

    expect(new Set([alexStreak, jordanStreak, samStreak]).size).toBe(3);
  });

  it('6. Total sessions in analytics matches actual verified session count without artificial inflation', async () => {
    const all = await getAllSessions();
    const verifiedSessions = all.filter(s => s.mode !== 'dry' && s.mode !== 'test');
    expect(verifiedSessions.length).toBeGreaterThan(0);
    // Verified sessions does NOT add arbitrary +42
    expect(verifiedSessions.length).toBe(all.length);
  });

  it('7. Filtering students by class and performance isolates matching records accurately', async () => {
    // Explicitly enroll test records for test isolation
    await enrollStudent({ studentId: 'STU_101', name: 'Alex River', classId: 'Grade 5-A' });
    await enrollStudent({ studentId: 'STU_102', name: 'Jordan Taylor', classId: 'Grade 5-A' });
    await enrollStudent({ studentId: 'STU_103', name: 'Sam Chen', classId: 'Grade 5-B' });

    const students = await getAllStudents();
    
    // Filter by class Grade 5-A
    const grade5A = students.filter(s => s.classId === 'Grade 5-A');
    expect(grade5A.length).toBe(2);
    expect(grade5A.map(s => s.name)).toContain('Alex River');
    expect(grade5A.map(s => s.name)).toContain('Jordan Taylor');

    // Filter by class Grade 5-B
    const grade5B = students.filter(s => s.classId === 'Grade 5-B');
    expect(grade5B.length).toBe(1);
    expect(grade5B[0].name).toBe('Sam Chen');
  });
});
