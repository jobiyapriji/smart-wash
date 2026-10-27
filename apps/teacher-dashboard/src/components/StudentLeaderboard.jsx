import React from 'react';
import { Trophy, Flame, Medal } from 'lucide-react';

/**
 * StudentLeaderboard Component
 * Renders ranked student compliance table with podium badges (Amber, Pink, Mint)
 * and flame streak circles in the Playful Geometric style.
 */
export function StudentLeaderboard({ students = [] }) {
  const defaultStudents = [
    { studentId: 'STU_101', name: 'Jesty K.', score: 98, streak: 7, grade: 'Excellent' },
    { studentId: 'STU_102', name: 'Jobiya P.', score: 95, streak: 5, grade: 'Excellent' },
    { studentId: 'STU_103', name: 'Joel T.', score: 91, streak: 4, grade: 'Excellent' },
    { studentId: 'STU_104', name: 'Rahul M.', score: 88, streak: 3, grade: 'Good' },
    { studentId: 'STU_105', name: 'Ananya S.', score: 82, streak: 2, grade: 'Good' }
  ];

  const leaderboardData = (students.length > 0 ? students : defaultStudents)
    .slice()
    .sort((a, b) => ((b.score ?? 0) - (a.score ?? 0)) || ((b.streak ?? 0) - (a.streak ?? 0)));

  // Podium medal colors: 1 = Amber, 2 = Pink, 3 = Mint
  const getPodiumBadge = (rank) => {
    if (rank === 1) return { bg: '#FBBF24', text: '#1E293B', label: '1st', icon: '🥇' };
    if (rank === 2) return { bg: '#F472B6', text: '#1E293B', label: '2nd', icon: '🥈' };
    if (rank === 3) return { bg: '#34D399', text: '#1E293B', label: '3rd', icon: '🥉' };
    return { bg: '#F1F5F9', text: '#64748B', label: `#${rank}`, icon: null };
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      padding: '24px',
      border: '2.5px solid #1E293B',
      boxShadow: '4px 4px 0px 0px #1E293B',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            Student Compliance Leaderboard
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Ranked by Handwashing Score & Streak
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: '#1E293B',
          background: '#FEF3C7',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontWeight: 800,
          border: '1.5px solid #1E293B',
          boxShadow: '2px 2px 0px 0px #1E293B',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <Trophy size={14} strokeWidth={2.5} color="#1E293B" />
          <span>Top Performers</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {leaderboardData.map((st, index) => {
          const rank = index + 1;
          const badge = getPodiumBadge(rank);

          return (
            <div
              key={st.studentId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: rank <= 3 ? '#FFFDF5' : '#FFFFFF',
                borderRadius: '16px',
                border: '2px solid #1E293B',
                boxShadow: rank <= 3 ? '3px 3px 0px 0px #1E293B' : '2px 2px 0px 0px #E2E8F0',
                transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-2px, -2px)';
                e.currentTarget.style.boxShadow = '5px 5px 0px 0px #1E293B';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = rank <= 3 ? '3px 3px 0px 0px #1E293B' : '2px 2px 0px 0px #E2E8F0';
              }}
            >
              {/* Rank & Student Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  background: badge.bg,
                  border: '2px solid #1E293B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '13px',
                  color: badge.text,
                  boxShadow: '2px 2px 0px 0px #1E293B',
                  fontFamily: 'Outfit, sans-serif',
                  flexShrink: 0
                }}>
                  {badge.icon || badge.label}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
                    {st.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                    ID: {st.studentId}
                  </div>
                </div>
              </div>

              {/* Streak & Score */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Flame Streak Circle Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: (st.streak || 0) > 0 ? '#FEF3C7' : '#F1F5F9',
                  border: '1.5px solid #1E293B',
                  borderRadius: '9999px',
                  padding: '4px 10px',
                  boxShadow: '1.5px 1.5px 0px 0px #1E293B'
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: (st.streak || 0) > 0 ? '#F59E0B' : '#94A3B8',
                    border: '1px solid #1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Flame
                      size={12}
                      strokeWidth={2.5}
                      color="#FFFFFF"
                      fill={(st.streak || 0) > 0 ? '#FFFFFF' : 'none'}
                    />
                  </div>
                  <span style={{
                    fontSize: '12px',
                    color: (st.streak || 0) > 0 ? '#1E293B' : '#64748B',
                    fontWeight: 800,
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    {st.streak || 0}
                  </span>
                </div>

                {/* Score Sticker Badge */}
                <div style={{
                  background: st.score !== null && st.score !== undefined ? (st.score >= 80 ? '#D1FAE5' : '#FEF3C7') : '#F1F5F9',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  border: '2px solid #1E293B',
                  fontWeight: 900,
                  color: '#1E293B',
                  fontSize: '15px',
                  boxShadow: '2px 2px 0px 0px #1E293B',
                  fontFamily: 'Outfit, sans-serif',
                  whiteSpace: 'nowrap'
                }}>
                  {st.score !== null && st.score !== undefined ? (
                    <>
                      {st.score} <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>/ 100</span>
                    </>
                  ) : (
                    <span style={{ color: '#64748B', fontSize: '13px' }}>N/A</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StudentLeaderboard;
