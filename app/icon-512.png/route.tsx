import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Disable caching to always serve fresh icons
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const response = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #E855A8 0%, #C5459C 50%, #9B3578 100%)',
          borderRadius: '100px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ width: '26px', height: '120px', background: 'white', borderRadius: '13px' }} />
            <div style={{ width: '26px', height: '120px', background: 'white', borderRadius: '13px' }} />
            <div style={{ width: '26px', height: '120px', background: 'white', borderRadius: '13px' }} />
          </div>
          <div style={{ width: '142px', height: '36px', background: 'white', borderRadius: '18px' }} />
          <div style={{ width: '48px', height: '150px', background: 'white', borderRadius: '24px' }} />
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
  
  return response
}

