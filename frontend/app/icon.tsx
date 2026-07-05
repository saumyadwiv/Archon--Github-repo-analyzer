import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

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
          background: '#0A0C10',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="3" fill="#8B7BFF" />
          <circle cx="18" cy="6" r="3" fill="#6E5BFF" />
          <circle cx="12" cy="19" r="3" fill="#34D399" />
          <path d="M8.4 7.6L15.6 7.6" stroke="#3A4053" strokeWidth="2" />
          <path d="M7.2 8.7L11 17" stroke="#3A4053" strokeWidth="2" />
          <path d="M16.8 8.7L13 17" stroke="#3A4053" strokeWidth="2" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
