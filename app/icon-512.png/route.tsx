import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
    }
  )
}

