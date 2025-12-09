import { ImageResponse } from 'next/og'
 
// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Disable caching to always serve fresh icons
export const dynamic = 'force-dynamic'
export const revalidate = 0
 
// Image generation
export default function Icon() {
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
          borderRadius: '8px',
          position: 'relative',
        }}
      >
        {/* Fork icon simplified */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1px',
          }}
        >
          {/* Fork prongs */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
            }}
          >
            <div style={{ width: '2px', height: '8px', background: 'white', borderRadius: '1px' }} />
            <div style={{ width: '2px', height: '8px', background: 'white', borderRadius: '1px' }} />
            <div style={{ width: '2px', height: '8px', background: 'white', borderRadius: '1px' }} />
          </div>
          {/* Fork handle */}
          <div style={{ width: '10px', height: '3px', background: 'white', borderRadius: '2px' }} />
          <div style={{ width: '4px', height: '10px', background: 'white', borderRadius: '2px' }} />
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}

