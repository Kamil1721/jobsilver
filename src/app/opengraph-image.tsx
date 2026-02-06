import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'JobSilver - AI-Powered Job Search Assistant'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.02) 0%, transparent 50%)',
            display: 'flex',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent, #C0C0C0, transparent)',
            display: 'flex',
          }}
        />

        {/* Logo mark - JS in a box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '120px',
            height: '120px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #4A4A4A, #2A2A2A, #3A3A3A)',
            marginBottom: '32px',
            border: '2px solid rgba(192,192,192,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #F0F0F0, #C8C8C8, #E0E0E0)',
            }}
          >
            <span
              style={{
                fontSize: '52px',
                fontWeight: 700,
                color: '#2A2A2A',
                letterSpacing: '-2px',
              }}
            >
              JS
            </span>
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '1px',
            }}
          >
            Job
          </span>
          <span
            style={{
              fontSize: '64px',
              fontWeight: 600,
              color: '#909090',
              letterSpacing: '1px',
            }}
          >
            Silver
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: '28px',
            color: '#888888',
            margin: 0,
            letterSpacing: '0.5px',
          }}
        >
          AI-Powered Job Search Assistant
        </p>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '40px',
          }}
        >
          {['Smart Matching', 'AI Assistant', 'Application Tracking'].map((feature) => (
            <div
              key={feature}
              style={{
                padding: '10px 24px',
                borderRadius: '24px',
                border: '1px solid rgba(192,192,192,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#AAAAAA',
                fontSize: '18px',
                display: 'flex',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: '#666666', fontSize: '16px' }}>
            jobsilver.com
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
