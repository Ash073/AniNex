import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const footerStyle = {
    background: '#01040f',
    padding: '120px 10% 60px',
    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
    position: 'relative',
    zIndex: 1,
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
    gap: '80px',
    marginBottom: '100px',
  };

  const titleStyle = {
    fontSize: '20px',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '32px',
    letterSpacing: '-0.5px',
  };

  const linkListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    fontSize: '15px',
    fontWeight: '500',
  };

  const linkStyle = {
    color: 'rgba(255,255,255,0.4)',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
  };

  return (
    <footer style={footerStyle}>
      <div className="mesh-bg" style={{ opacity: 0.5 }}></div>
      <div style={gridStyle}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              overflow: 'hidden', 
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src="/adaptive-icon.png" 
                alt="AniNex Logo" 
                style={{ width: '130%', height: '130%', objectFit: 'contain' }} 
              />
            </div>
            <span className="gradient-text" style={{ fontSize: '26px' }}>AniNex</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', lineHeight: '1.8', maxWidth: '320px' }}>
            Elevating the anime communication experience through state-of-the-art tech and fluid design. Join the next generation.
          </p>
        </div>
        <div>
          <h3 style={titleStyle}>The Product</h3>
          <div style={linkListStyle}>
            <Link to="/download" style={linkStyle}>Download Mobile</Link>
            <Link to="/" style={linkStyle}>Features Guide</Link>
            <Link to="/about" style={linkStyle}>Our Vision</Link>
          </div>
        </div>
        <div>
          <h3 style={titleStyle}>Community HUB</h3>
          <div style={linkListStyle}>
            <a href="https://discord.gg/AniNex" style={linkStyle}>Discord Servers</a>
            <a href="https://twitter.com/AniNex" style={linkStyle}>Twitter Updates</a>
            <a href="https://reddit.com/r/AniNex" style={linkStyle}>Reddit Lounge</a>
          </div>
        </div>
        <div>
          <h3 style={titleStyle}>About Company</h3>
          <div style={linkListStyle}>
            <Link to="/about" style={linkStyle}>Our Story</Link>
            <Link to="/blogs" style={linkStyle}>Update Logs</Link>
            <Link to="/privacy" style={linkStyle}>Privacy Center</Link>
          </div>
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '60px', display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: '500' }}>
        <p>&copy; 2026 AniNex Inc. Refined with &hearts; for the community.</p>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <span style={{ cursor: 'pointer', transition: 'color 0.3s ease' }}>Terms of Service</span>
          <span style={{ cursor: 'pointer', transition: 'color 0.3s ease' }}>Cookie Settings</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgb(34, 197, 94)' }}></span>
             <span>Network Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
