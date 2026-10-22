import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus, ArrowRight } from 'lucide-react';

export function StudentManagementList({ students = [], refreshData }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(st =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            Student Roster
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Manage registered students, biometrics, and compliance histories
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={16} strokeWidth={2.5} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '10px 16px 10px 38px',
                borderRadius: '12px',
                border: '2px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#1E293B',
                fontSize: '13px',
                fontWeight: 600,
                width: '240px',
                outline: 'none',
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

          {/* Enroll Student Candy Button */}
          <Link
            to="/teacher/students/add"
            style={{
              padding: '10px 20px',
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
            <span>+ Enroll Student</span>
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
                <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                  No students found matching "{searchTerm}".
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
