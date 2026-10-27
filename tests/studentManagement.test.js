import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getAllStudents, 
  getStudentById, 
  enrollStudent, 
  deleteStudent,
  _resetMockStudentsForTesting 
} from '../shared/services/studentService.js';
import { getStudentSessions, createSession } from '../shared/services/sessionService.js';

describe('Student Management & Clean Database Audit', () => {

  beforeEach(() => {
    _resetMockStudentsForTesting();
  });

  it('1. Returns empty student list when no students have been enrolled (no demo student seeding)', async () => {
    const students = await getAllStudents();
    expect(students).toEqual([]);
    expect(students.length).toBe(0);

    // Verify Alex River, Jordan Taylor, Sam Chen are NOT present by default
    const names = students.map(s => s.name);
    expect(names).not.toContain('Alex River');
    expect(names).not.toContain('Jordan Taylor');
    expect(names).not.toContain('Sam Chen');
  });

  it('2. Enrolls genuine students and retrieves them accurately', async () => {
    const genuineStudent = {
      studentId: 'STU_GENUINE_01',
      name: 'Maria Garcia',
      className: 'Grade 4',
      section: 'B',
      rollNumber: '14'
    };

    const enrolled = await enrollStudent(genuineStudent);
    expect(enrolled).toBe(true);

    const students = await getAllStudents();
    expect(students.length).toBe(1);
    expect(students[0].studentId).toBe('STU_GENUINE_01');
    expect(students[0].name).toBe('Maria Garcia');

    const byId = await getStudentById('STU_GENUINE_01');
    expect(byId).not.toBeNull();
    expect(byId.name).toBe('Maria Garcia');
  });

  it('3. Successfully deletes a student by their unique student ID', async () => {
    await enrollStudent({
      studentId: 'STU_TO_DELETE',
      name: 'Test Student',
      className: 'Grade 3',
      section: 'A'
    });

    let students = await getAllStudents();
    expect(students.some(s => s.studentId === 'STU_TO_DELETE')).toBe(true);

    // Perform deletion
    const deleted = await deleteStudent('STU_TO_DELETE');
    expect(deleted).toBe(true);

    // Verify removed from database
    students = await getAllStudents();
    expect(students.some(s => s.studentId === 'STU_TO_DELETE')).toBe(false);

    const lookup = await getStudentById('STU_TO_DELETE');
    expect(lookup).toBeNull();
  });

  it('4. Deletion only removes the targeted student and preserves other genuine students', async () => {
    await enrollStudent({ studentId: 'STUDENT_A', name: 'Alice Smith', className: 'Grade 6' });
    await enrollStudent({ studentId: 'STUDENT_B', name: 'Bob Jones', className: 'Grade 6' });
    await enrollStudent({ studentId: 'STUDENT_C', name: 'Charlie Brown', className: 'Grade 6' });

    expect((await getAllStudents()).length).toBe(3);

    // Delete only STUDENT_B
    await deleteStudent('STUDENT_B');

    const remaining = await getAllStudents();
    expect(remaining.length).toBe(2);
    expect(remaining.map(s => s.studentId).sort()).toEqual(['STUDENT_A', 'STUDENT_C'].sort());
    expect(remaining.map(s => s.name)).toContain('Alice Smith');
    expect(remaining.map(s => s.name)).toContain('Charlie Brown');
    expect(remaining.map(s => s.name)).not.toContain('Bob Jones');
  });

  it('5. Throws helpful error when trying to delete non-existent or invalid studentId', async () => {
    await expect(deleteStudent('NON_EXISTENT_ID')).rejects.toThrow(/not found/i);
    await expect(deleteStudent('')).rejects.toThrow(/valid studentId is required/i);
    await expect(deleteStudent(null)).rejects.toThrow(/valid studentId is required/i);
  });

  it('6. Preserves historical session records when a student is deleted (data retention compliance)', async () => {
    const studentId = 'STU_WITH_SESSIONS';
    await enrollStudent({ studentId, name: 'David Miller', className: 'Grade 5' });

    // Create session associated with this student
    const { id: sessionId } = await createSession(studentId, 'David Miller', 'face_recognition', 'Grade 5');
    expect(sessionId).toBeDefined();

    // Verify session exists
    let sessions = await getStudentSessions(studentId);
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    // Delete the student
    await deleteStudent(studentId);

    // Confirm student was deleted
    const student = await getStudentById(studentId);
    expect(student).toBeNull();

    // Confirm session record is retained in database for audit integrity
    sessions = await getStudentSessions(studentId);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions[0].studentId).toBe(studentId);
  });
});
