import { ImageResponse } from 'next/og'
 
// Image metadata
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'
 
// Image generation
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #E855A8 0%, #C5459C 50%, #9B3578 100%)',
          borderRadius: '40px',
          position: 'relative',
        }}
      >
        {/* Fork icon */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {/* Fork prongs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '40px', background: 'white', borderRadius: '4px' }} />
            <div style={{ width: '8px', height: '40px', background: 'white', borderRadius: '4px' }} />
            <div style={{ width: '8px', height: '40px', background: 'white', borderRadius: '4px' }} />
          </div>
          {/* Fork connector */}
          <div style={{ width: '48px', height: '12px', background: 'white', borderRadius: '6px' }} />
          {/* Fork handle */}
          <div style={{ width: '16px', height: '50px', background: 'white', borderRadius: '8px' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

