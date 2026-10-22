import React from 'react';

/**
 * SMART WASH — Cartoon Hand Rubbing Animation
 * Recreated with exact styling from user reference:
 * - Bright red sleeve cuffs with round button
 * - Warm flesh tone hands with bold cartoon outlines
 * - White fingernails and knuckle creases
 * - Two hands rubbing together in handwashing posture
 * - Pastel blue soap bubbles with white reflection highlights and floating bubbles
 */
export function HandsRubbingAnimation({ size = 200 }) {
  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${Math.round(size * 0.78)}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        userSelect: 'none'
      }}
    >
      <style>{`
        @keyframes scrubFrontHand {
          0%, 100% {
            transform: translate(-6px, -4px) rotate(-1.5deg);
          }
          50% {
            transform: translate(7px, 5px) rotate(2deg);
          }
        }
        @keyframes scrubBackHand {
          0%, 100% {
            transform: translate(4px, 3px) rotate(1deg);
          }
          50% {
            transform: translate(-4px, -3px) rotate(-1deg);
          }
        }
        @keyframes latherPulse {
          0%, 100% {
            transform: scale(0.96) translate(0, 0);
          }
          50% {
            transform: scale(1.05) translate(2px, 1px);
          }
        }
        @keyframes floatBubbleUp1 {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          30% {
            opacity: 0.95;
          }
          100% {
            transform: translate(-10px, -42px) scale(1.2);
            opacity: 0;
          }
        }
        @keyframes floatBubbleUp2 {
          0% {
            transform: translate(0, 0) scale(0.5);
            opacity: 0;
          }
          35% {
            opacity: 0.95;
          }
          100% {
            transform: translate(12px, -48px) scale(1.15);
            opacity: 0;
          }
        }
        @keyframes floatBubbleUp3 {
          0% {
            transform: translate(0, 0) scale(0.65);
            opacity: 0;
          }
          40% {
            opacity: 0.95;
          }
          100% {
            transform: translate(6px, -36px) scale(1.25);
            opacity: 0;
          }
        }
        @keyframes sparkleCross {
          0%, 100% {
            transform: scale(0.8) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.25) rotate(45deg);
            opacity: 1;
          }
        }
      `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 280 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Subtle drop shadow for layered depth */}
          <filter id="handShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Top-Right White Sparkle Cross */}
        <g
          style={{
            transformOrigin: '235px 22px',
            animation: 'sparkleCross 2.2s infinite ease-in-out'
          }}
        >
          <path
            d="M 235 14 L 235 30 M 227 22 L 243 22"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Ambient Soap Lather Background Bubbles */}
        <g style={{ transformOrigin: '150px 105px', animation: 'latherPulse 1.2s infinite ease-in-out' }}>
          {/* Bubble between wrists */}
          <circle cx="95" cy="88" r="14" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="91" cy="83" r="3.5" fill="#ffffff" />

          {/* Bubble above back hand */}
          <circle cx="138" cy="24" r="9" fill="#bae6fd" stroke="#1e293b" strokeWidth="2.8" />
          <circle cx="135" cy="21" r="2.2" fill="#ffffff" />

          {/* Small floating bubble top right */}
          <circle cx="206" cy="38" r="9" fill="#bae6fd" stroke="#1e293b" strokeWidth="2.8" />
          <circle cx="203" cy="35" r="2.2" fill="#ffffff" />

          {/* Large bubble under top hand */}
          <circle cx="118" cy="58" r="15" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="113" cy="52" r="4.2" fill="#ffffff" />

          {/* Bubble cluster behind fingers */}
          <circle cx="166" cy="82" r="16" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="160" cy="76" r="4.5" fill="#ffffff" />

          <circle cx="210" cy="98" r="16" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="204" cy="92" r="4.5" fill="#ffffff" />

          {/* Bubble cluster below fingers */}
          <circle cx="145" cy="178" r="15" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="140" cy="172" r="4" fill="#ffffff" />

          <circle cx="178" cy="172" r="13" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="174" cy="167" r="3.5" fill="#ffffff" />

          {/* Bubble bottom right */}
          <circle cx="228" cy="162" r="8.5" fill="#bae6fd" stroke="#1e293b" strokeWidth="2.8" />
          <circle cx="225" cy="159" r="2.2" fill="#ffffff" />
        </g>

        {/* ================= 1. BACK HAND (UNDERNEATH) ================= */}
        <g
          id="backHandGroup"
          style={{
            transformOrigin: '90px 60px',
            animation: 'scrubBackHand 1.1s infinite ease-in-out'
          }}
        >
          {/* Back Hand Flesh & Fingers */}
          {/* Thumb pointing up-right */}
          <path
            d="M 125 58 
               C 132 45, 142 32, 160 30 
               C 178 28, 192 38, 190 48 
               C 188 56, 172 65, 155 72 
               Z"
            fill="#fcd5b8"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Thumb nail */}
          <path
            d="M 174 34 
               C 183 34, 186 38, 185 45 
               C 180 46, 172 44, 172 38 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Back fingers extending to the right behind front hand */}
          <path
            d="M 155 72 
               C 175 62, 205 60, 222 72 
               C 228 76, 228 85, 220 90 
               C 200 98, 168 100, 150 96 
               Z"
            fill="#fcd5b8"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Back hand index nail */}
          <path
            d="M 212 72 
               C 220 74, 222 79, 219 84 
               C 214 84, 208 81, 210 75 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Upper Wrist connection */}
          <path
            d="M 82 48 L 126 58 L 105 85 L 75 72 Z"
            fill="#fcd5b8"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Upper Red Sleeve Cuff */}
          <g filter="url(#handShadow)">
            <path
              d="M 46 38 
                 L 88 18 
                 L 110 65 
                 L 68 85 
                 Z"
              fill="#ef233c"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Dark inner shadow line on cuff edge */}
            <path
              d="M 88 18 L 110 65"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Cuff Button */}
            <circle
              cx="92"
              cy="48"
              r="6"
              fill="#fbcfe8"
              stroke="#1e293b"
              strokeWidth="2.5"
            />
          </g>
        </g>

        {/* Dynamic Bubble between the two palms */}
        <g style={{ transformOrigin: '140px 105px', animation: 'latherPulse 1.1s infinite ease-in-out' }}>
          <circle cx="102" cy="115" r="16" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="96" cy="109" r="4.2" fill="#ffffff" />

          <circle cx="162" cy="120" r="14" fill="#bae6fd" stroke="#1e293b" strokeWidth="3" />
          <circle cx="157" cy="114" r="3.8" fill="#ffffff" />
        </g>

        {/* ================= 2. FRONT HAND (TOP LAYER) ================= */}
        <g
          id="frontHandGroup"
          style={{
            transformOrigin: '95px 145px',
            animation: 'scrubFrontHand 1.1s infinite ease-in-out'
          }}
          filter="url(#handShadow)"
        >
          {/* Main Hand Palm + Fingers Outline */}
          {/* Hand Palm body & Thumb */}
          <path
            d="M 98 120 
               /* Curve up into the thumb */
               C 105 98, 120 68, 138 52 
               C 146 44, 155 46, 156 56 
               C 157 66, 148 82, 142 98 
               /* Webbing to index finger */
               C 146 95, 158 90, 168 88 
               /* Index finger */
               L 204 74 
               C 214 70, 222 78, 218 88 
               L 182 105 
               /* Middle finger */
               L 225 96 
               C 236 94, 242 102, 238 112 
               L 190 126 
               /* Ring finger */
               L 220 122 
               C 230 122, 234 132, 228 140 
               L 184 148 
               /* Pinky finger */
               L 205 148 
               C 214 148, 218 158, 210 165 
               L 170 170 
               /* Palm edge down to wrist */
               C 145 174, 120 172, 102 170 
               Z"
            fill="#fcd5b8"
            stroke="#1e293b"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Finger Separators Lines */}
          {/* Between Index & Middle */}
          <path
            d="M 166 100 L 196 92"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Between Middle & Ring */}
          <path
            d="M 172 120 L 202 113"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Between Ring & Pinky */}
          <path
            d="M 168 142 L 195 137"
            stroke="#1e293b"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Thumb Crease line */}
          <path
            d="M 132 85 C 130 96, 134 110, 140 118"
            stroke="#f87171"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Knuckle Creases */}
          {/* Thumb knuckle */}
          <path d="M 142 66 L 148 64" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          {/* Index knuckles */}
          <path d="M 176 84 L 178 88" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 194 78 L 196 82" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          {/* Middle knuckles */}
          <path d="M 188 104 L 190 109" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 210 99 L 212 104" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          {/* Ring knuckles */}
          <path d="M 184 126 L 186 131" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 204 123 L 206 128" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          {/* Pinky knuckles */}
          <path d="M 178 152 L 180 156" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 194 150 L 196 154" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" />

          {/* ================= WHITE FINGERNAILS ================= */}
          {/* Thumb Nail */}
          <path
            d="M 148 48 
               C 154 48, 156 52, 154 58 
               C 149 59, 144 57, 144 52 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Index Nail */}
          <path
            d="M 208 72 
               C 216 71, 219 75, 216 83 
               C 210 83, 204 80, 205 74 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Middle Nail */}
          <path
            d="M 227 96 
               C 236 95, 239 101, 235 108 
               C 229 108, 223 105, 224 99 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Ring Nail */}
          <path
            d="M 218 123 
               C 226 123, 230 128, 226 136 
               C 220 135, 215 132, 216 126 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Pinky Nail */}
          <path
            d="M 202 149 
               C 210 149, 213 154, 209 161 
               C 203 160, 199 157, 200 151 
               Z"
            fill="#ffffff"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Lower Red Sleeve Cuff */}
          <g>
            <path
              d="M 50 118 
                 L 94 112 
                 L 105 172 
                 L 61 178 
                 Z"
              fill="#ef233c"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Cuff hemline */}
            <path
              d="M 94 112 L 105 172"
              stroke="#1e293b"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Button */}
            <circle
              cx="80"
              cy="154"
              r="6.5"
              fill="#fbcfe8"
              stroke="#1e293b"
              strokeWidth="2.5"
            />
          </g>
        </g>

        {/* ================= 3. FLOATING ANIMATED BUBBLES ================= */}
        {/* Floating Bubble 1 */}
        <g style={{ animation: 'floatBubbleUp1 2.0s infinite ease-out' }}>
          <circle cx="120" cy="50" r="7" fill="#bae6fd" stroke="#1e293b" strokeWidth="2.2" />
          <circle cx="118" cy="48" r="1.8" fill="#ffffff" />
        </g>

        {/* Floating Bubble 2 */}
        <g style={{ animation: 'floatBubbleUp2 2.4s infinite ease-out 0.5s' }}>
          <circle cx="180" cy="60" r="8" fill="#bae6fd" stroke="#1e293b" strokeWidth="2.2" />
          <circle cx="178" cy="58" r="2" fill="#ffffff" />
        </g>

        {/* Floating Bubble 3 */}
        <g style={{ animation: 'floatBubbleUp3 2.2s infinite ease-out 1.0s' }}>
          <circle cx="160" cy="40" r="6" fill="#bae6fd" stroke="#1e293b" strokeWidth="2" />
          <circle cx="158" cy="38" r="1.6" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

export default HandsRubbingAnimation;
