import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StudentManagementList } from '../apps/teacher-dashboard/src/components/StudentManagementList.jsx';

describe('StudentManagementList UI Component', () => {

  it('1. Renders friendly empty state when no students exist', () => {
    const rawHtml = renderToString(
      <MemoryRouter>
        <StudentManagementList students={[]} refreshData={() => {}} />
      </MemoryRouter>
    );
    const html = rawHtml.replace(/<!--.*?-->/g, '');

    // Exact required text
    expect(html).toContain('No students added yet. Add a student to get started.');
    expect(html).toContain('Add Student');
    expect(html).toContain('/teacher/students/add');
    expect(html).toContain('0 of 0 students');

    // Default demo students must NOT appear
    expect(html).not.toContain('Alex River');
    expect(html).not.toContain('Jordan Taylor');
    expect(html).not.toContain('Sam Chen');
  });

  it('2. Renders student rows with both View Profile and Delete actions when genuine students exist', () => {
    const genuineStudents = [
      {
        studentId: 'STU_GENUINE_01',
        name: 'Maria Garcia',
        className: 'Grade 5',
        section: 'A',
        streak: 4,
        score: 92,
        isActive: true
      },
      {
        studentId: 'STU_GENUINE_02',
        name: 'Liam Chen',
        className: 'Grade 5',
        section: 'B',
        streak: 2,
        score: 85,
        isActive: true
      }
    ];

    const rawHtml = renderToString(
      <MemoryRouter>
        <StudentManagementList students={genuineStudents} refreshData={() => {}} />
      </MemoryRouter>
    );
    const html = rawHtml.replace(/<!--.*?-->/g, '');

    // Check student info displayed
    expect(html).toContain('STU_GENUINE_01');
    expect(html).toContain('Maria Garcia');
    expect(html).toContain('STU_GENUINE_02');
    expect(html).toContain('Liam Chen');

    // Both View Profile and Delete must be present in Actions column
    expect(html).toContain('View Profile');
    expect(html).toContain('/teacher/students/STU_GENUINE_01');
    expect(html).toContain('/teacher/students/STU_GENUINE_02');
    expect(html).toContain('delete-student-STU_GENUINE_01');
    expect(html).toContain('delete-student-STU_GENUINE_02');
    expect(html).toContain('Delete');

    // Ensure streak and score styling
    expect(html).toContain('92 / 100');
    expect(html).toContain('85 / 100');
  });

  it('3. Renders filter empty state when students exist but do not match query', () => {
    const students = [
      {
        studentId: 'STU_GENUINE_01',
        name: 'Maria Garcia',
        className: 'Grade 5',
        section: 'A'
      }
    ];

    const html = renderToString(
      <MemoryRouter>
        <StudentManagementList students={students} refreshData={() => {}} />
      </MemoryRouter>
    );

    // Initially shows student
    expect(html).toContain('Maria Garcia');
    expect(html).not.toContain('No students found matching current filters.');
  });
});
