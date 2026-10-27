import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, ArrowRight, Flame, Filter, ChevronDown, RotateCcw } from 'lucide-react';

export function StudentManagementList({ students = [], refreshData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedPerformance, setSelectedPerformance] = useState('ALL');

  // Helper to extract clean class label
  const getStudentClassLabel = (st) => {
    if (st.className && st.section) return `${st.className}-${st.section}`;
    if (st.classId) return st.classId;
    if (st.className) return st.className;
    return 'Unassigned';
  };

  // Derive unique classes from active students
  const availableClasses = Array.from(
    new Set(students.map(getStudentClassLabel).filter(Boolean))
  ).sort();

  const filteredStudents = students.filter(st => {
    // 1. Search Query (Name or ID)
    const matchesSearch = 
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Class Filter
    if (selectedClass !== 'ALL') {
      const classLabel = getStudentClassLabel(st);
      const matchesClass = 
        classLabel === selectedClass ||
        st.classId === selectedClass ||
        st.className === selectedClass;
      if (!matchesClass) return false;
    }

    // 3. Performance / Streak Filter
    if (selectedPerformance === 'ACTIVE_STREAK') {
      if ((st.streak || 0) <= 0) return false;
    } else if (selectedPerformance === 'ZERO_STREAK') {
      if ((st.streak || 0) > 0) return false;
    } else if (selectedPerformance === 'HIGH_SCORE') {
      if (st.score === null || st.score === undefined || st.score < 80) return false;
    } else if (selectedPerformance === 'NEEDS_PRACTICE') {
      if (st.score === null || st.score === undefined || st.score >= 70) return false;
    }

    return true;
  });

  const isFiltered = searchTerm !== '' || selectedClass !== 'ALL' || selectedPerformance !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedClass('ALL');
    setSelectedPerformance('ALL');
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      padding: '28px',
      border: '2.5px solid #1E293B',
      boxShadow: '4px 4px 0px 0px #1E293B',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
              Student Roster
            </h2>
            <span style={{
              background: '#EDE9FE',
              color: '#6D28D9',
              border: '1.5px solid #1E293B',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif'
            }}>
              {filteredStudents.length} of {students.length} students
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Manage registered students, biometrics, and compliance histories
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={16} strokeWidth={2.5} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '10px 14px 10px 38px',
                borderRadius: '12px',
                border: '2px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontSize: '13px',
                fontWeight: 600,
                width: '180px',
                outline: 'none',
                fontFamily: 'Outfit, sans-serif',
                transition: 'all 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B5CF6';
                e.target.style.boxShadow = '3px 3px 0px 0px #8B5CF6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Class Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <Filter size={14} strokeWidth={2.5} color="#64748B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{
                padding: '10px 30px 10px 32px',
                borderRadius: '12px',
                border: selectedClass !== 'ALL' ? '2px solid #8B5CF6' : '2px solid #CBD5E1',
                background: selectedClass !== 'ALL' ? '#F5F3FF' : '#FFFFFF',
                color: '#1E293B',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                boxShadow: selectedClass !== 'ALL' ? '2px 2px 0 0 #8B5CF6' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <option value="ALL">All Classes</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <ChevronDown size={14} strokeWidth={2.5} color="#64748B" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Performance / Streak Filter Dropdown */}
          <div style={{ position: 'relative' }}>
            <Flame size={14} strokeWidth={2.5} color={selectedPerformance !== 'ALL' ? '#F59E0B' : '#64748B'} fill={selectedPerformance === 'ACTIVE_STREAK' ? '#F59E0B' : 'none'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select
              value={selectedPerformance}
              onChange={(e) => setSelectedPerformance(e.target.value)}
              style={{
                padding: '10px 30px 10px 32px',
                borderRadius: '12px',
                border: selectedPerformance !== 'ALL' ? '2px solid #F59E0B' : '2px solid #CBD5E1',
                background: selectedPerformance !== 'ALL' ? '#FFFBEB' : '#FFFFFF',
                color: '#1E293B',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                boxShadow: selectedPerformance !== 'ALL' ? '2px 2px 0 0 #F59E0B' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <option value="ALL">All Streaks / Scores</option>
              <option value="ACTIVE_STREAK">🔥 Active Streak (&gt; 0)</option>
              <option value="ZERO_STREAK">Needs Streak (0)</option>
              <option value="HIGH_SCORE">🌟 High Score (≥ 80%)</option>
              <option value="NEEDS_PRACTICE">⚠️ Needs Practice (&lt; 70%)</option>
            </select>
            <ChevronDown size={14} strokeWidth={2.5} color="#64748B" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Reset Filters Button */}
          {isFiltered && (
            <button
              onClick={resetFilters}
              title="Reset all filters"
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                background: '#FEE2E2',
                color: '#DC2626',
                border: '1.5px solid #1E293B',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '1.5px 1.5px 0 0 #1E293B',
                fontFamily: 'Outfit, sans-serif',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translate(-1px, -1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <RotateCcw size={12} strokeWidth={3} />
              <span>Reset</span>
            </button>
          )}

          {/* Enroll Student Candy Button */}
          <Link
            to="/teacher/students/add"
            style={{
              padding: '10px 18px',
              borderRadius: '9999px',
              background: '#8B5CF6',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '2px solid #1E293B',
              boxShadow: '3px 3px 0px 0px #1E293B',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <UserPlus size={16} strokeWidth={2.5} />
            <span>+ Enroll</span>
          </Link>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{
              borderBottom: '2.5px solid #1E293B',
              background: '#FFFDF5',
              color: '#1E293B',
              textAlign: 'left'
            }}>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>ID</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Student Name</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Class/Sec</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Streak</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Avg Score</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Status</th>
              <th style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? filteredStudents.map((st, idx) => (
              <tr
                key={st.studentId}
                style={{
                  borderBottom: '1px solid #E2E8F0',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '14px 16px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'Outfit, monospace, sans-serif' }}>
                  {st.studentId}
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {st.photoUrl ? (
                    <img
                      src={st.photoUrl}
                      alt={st.name}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #1E293B'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: idx % 2 === 0 ? '#FBBF24' : '#34D399',
                      border: '2px solid #1E293B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: '#1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}>
                      {st.name.charAt(0)}
                    </div>
                  )}
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '15px' }}>{st.name}</span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748B', fontWeight: 600 }}>
                  {st.className || 'N/A'} - {st.section || 'N/A'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: (st.streak || 0) > 0 ? '#FEF3C7' : '#F1F5F9',
                    border: '1.5px solid #1E293B',
                    borderRadius: '9999px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    <Flame
                      size={13}
                      color={(st.streak || 0) > 0 ? '#F59E0B' : '#94A3B8'}
                      fill={(st.streak || 0) > 0 ? '#F59E0B' : 'none'}
                    />
                    <span>{st.streak || 0}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                  {st.score !== null && st.score !== undefined ? (
                    <span style={{
                      background: st.score >= 80 ? '#D1FAE5' : (st.score >= 70 ? '#FEF3C7' : '#FEE2E2'),
                      color: '#1E293B',
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      border: '1.5px solid #1E293B',
                      fontSize: '12px'
                    }}>
                      {st.score} / 100
                    </span>
                  ) : (
                    <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 700 }}>N/A</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    background: st.isActive !== false ? '#D1FAE5' : '#FEE2E2',
                    color: '#1E293B',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 800,
                    border: '1.5px solid #1E293B',
                    display: 'inline-block',
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    {st.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <Link
                    to={`/teacher/students/${st.studentId}`}
                    style={{
                      color: '#8B5CF6',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    <span>View Profile</span>
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span>No students found matching current filters.</span>
                    {isFiltered && (
                      <button
                        onClick={resetFilters}
                        style={{
                          padding: '6px 14px',
                          background: '#EDE9FE',
                          color: '#6D28D9',
                          border: '1.5px solid #1E293B',
                          borderRadius: '9999px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: '12px'
                        }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudentManagementList;
