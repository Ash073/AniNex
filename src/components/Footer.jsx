import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Globe, Shield, HelpCircle, Code, Activity } from 'lucide-react';

/* 
  Vite/Lucide Compatibility Fix Level 2: 
  Twitter and Github exports are failing. 
  Using Globe, Code and MessageCircle as a reliable alternatives.
*/

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
    fontSize: '18px',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '32px',
    letterSpacing: '1px',
    fontFamily: "'Syncopate', sans-serif"
  };

  const linkListStyle = {
    display: 'flex', 
    flexDirection: 'column', 
    gap: '16px', 
    fontSize: '14px', 
    fontWeight: '500', 
    fontFamily: 'var(--font-sub)'
  };

  const linkStyle = {
    color: 'rgba(255,255,255,0.4)',
    transition: 'all 0.3s ease',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  return (
    <footer style={footerStyle}>
      <div className="mesh-bg" style={{ opacity: 0.5 }}></div>
      <div style={gridStyle} className="grid-3">
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
            <span className="gradient-text" style={{ fontSize: '22px', fontFamily: "'Syncopate', sans-serif" }}>AniNex</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '15px', lineHeight: '1.8', maxWidth: '320px', fontFamily: 'var(--font-sub)' }}>
            Elevating the anime communication experience through state-of-the-art tech and fluid design. Join the next generation of fandom connectivity.
          </p>
        </div>
        <div>
          <h3 style={titleStyle}>Product</h3>
          <div style={linkListStyle}>
            <Link to="/download" style={linkStyle}><Globe size={14}/> Mobile Portal</Link>
            <Link to="/" style={linkStyle}><Shield size={14}/> Security Features</Link>
            <Link to="/about" style={linkStyle}><HelpCircle size={14}/> Vision & Story</Link>
          </div>
        </div>
        <div>
          <h3 style={titleStyle}>Community</h3>
          <div style={linkListStyle}>
            <a href="https://discord.gg/AniNex" style={linkStyle}><MessageCircle size={14}/> Discord Feed</a>
            <a href="https://twitter.com/AniNex" style={linkStyle}><Globe size={14}/> Twitter updates</a>
            <a href="https://github.com/Ash073/AniNex" style={linkStyle}><Code size={14}/> Source Logs</a>
          </div>
        </div>
        <div>
          <h3 style={titleStyle}>Legal</h3>
          <div style={linkListStyle}>
            <Link to="/about" style={linkStyle}>Privacy Center</Link>
            <Link to="/blogs" style={linkStyle}>Update Hub</Link>
            <Link to="/privacy" style={linkStyle}>Terms of Sync</Link>
          </div>
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '60px', display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--font-sub)', letterSpacing: '1px' }}>
        <p>&copy; 2026 ANINEX INFRASTRUCTURE. ALL RIGHTS RESERVED.</p>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <span style={{ cursor: 'pointer', transition: 'color 0.3s ease' }}>TERMS</span>
          <span style={{ cursor: 'pointer', transition: 'color 0.3s ease' }}>PRIVACY</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgb(34, 197, 94)', boxShadow: '0 0 10px rgb(34, 197, 94)' }}></span>
             <Activity size={12} color="rgb(34, 197, 94)"/>
             <span>LIVE NETWORK</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
