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
          borderRadius: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '10px', height: '45px', background: 'white', borderRadius: '5px' }} />
            <div style={{ width: '10px', height: '45px', background: 'white', borderRadius: '5px' }} />
            <div style={{ width: '10px', height: '45px', background: 'white', borderRadius: '5px' }} />
          </div>
          <div style={{ width: '54px', height: '14px', background: 'white', borderRadius: '7px' }} />
          <div style={{ width: '18px', height: '55px', background: 'white', borderRadius: '9px' }} />
        </div>
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  )
}

