'use client';

interface LogoProps {
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export default function Logo({ onClick, size = 'medium' }: LogoProps) {
  const sizes = {
    small: { height: 32, fontSize: 20 },
    medium: { height: 40, fontSize: 24 },
    large: { height: 48, fontSize: 28 },
  };

  const { height, fontSize } = sizes[size];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease',
        userSelect: 'none',
      }}
      onMouseOver={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseOut={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {/* Logo icon - you can replace this with an <img> tag for a custom logo */}
      <div
        style={{
          height: `${height}px`,
          width: `${height}px`,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${fontSize}px`,
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
        }}
      >
        📸
      </div>
      
      {/* Logo text */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span
          style={{
            fontWeight: 'bold',
            fontSize: `${fontSize * 0.75}px`,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Family Album
        </span>
      </div>
    </div>
  );
}
