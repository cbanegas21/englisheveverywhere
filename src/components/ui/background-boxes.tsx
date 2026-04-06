'use client'

import React from 'react'
import { motion } from 'framer-motion'

// Crimson/burgundy hover palette — serious, not playful
const hoverColors = [
  'rgba(196,30,58,0.6)',   // crimson
  'rgba(156,20,40,0.5)',   // deep crimson
  'rgba(197,160,40,0.4)',  // gold
  'rgba(196,30,58,0.3)',   // crimson faint
  'rgba(120,15,30,0.5)',   // burgundy
  'rgba(197,160,40,0.3)',  // gold faint
]

function getColor() {
  return hoverColors[Math.floor(Math.random() * hoverColors.length)]
}

function BoxesCore({ className }: { className?: string }) {
  const rows = new Array(60).fill(1)
  const cols = new Array(40).fill(1)

  return (
    <div
      style={{
        transform: 'translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) translateZ(0)',
      }}
      className={`absolute left-1/4 p-4 -top-1/4 flex -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 ${className ?? ''}`}
    >
      {rows.map((_, i) => (
        <motion.div key={`row-${i}`} className="w-16 h-8 relative" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
          {cols.map((_, j) => (
            <motion.div
              key={`col-${j}`}
              whileHover={{ backgroundColor: getColor(), transition: { duration: 0 } }}
              className="w-16 h-8 relative"
              style={{ borderRight: '1px solid rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              {j % 3 === 0 && i % 3 === 0 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1"
                  stroke="currentColor"
                  className="absolute h-6 w-10 -top-[14px] -left-[22px] pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.04)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
              )}
            </motion.div>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

export const Boxes = React.memo(BoxesCore)
