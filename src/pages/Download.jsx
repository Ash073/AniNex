import React from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';

// Requirement 12 & 13: GitHub Release link variable
const DOWNLOAD_LINK = "https://github.com/Ash073/AniNex/releases/download/v1.5.0/aninex-v1.5.0.apk";

const Download = () => {
  const platforms = [
    {
      name: 'Android',
      version: 'v1.5.0',
      date: 'March 2026',
      size: '112 MB',
      icon: '📱',
      link: DOWNLOAD_LINK,
      status: 'Stable'
    },
    {
      name: 'Windows',
      version: 'v1.2.0',
      date: 'TBA',
      size: 'Coming soon',
      icon: '💻',
      link: '#',
      status: 'Development'
    },
    {
      name: 'Web App',
      version: 'Beta',
      date: 'TBA',
      size: 'Cloud',
      icon: '🌐',
      link: '#',
      status: 'Waitlist'
    }
  ];

  return (
    <Layout>
      <div className="mesh-bg"></div>
      <section style={{ padding: '80px 10%', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', position: 'relative' }}>

        {/* Glow Effects */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'var(--primary)', filter: 'blur(150px)', opacity: '0.15', zIndex: -1 }}></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <h1 style={{ fontSize: '72px', fontWeight: '900', marginBottom: '16px', letterSpacing: '-2px' }}>
            Elevate Your <span className="gradient-text">Experience</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px', maxWidth: '600px', margin: '0 auto' }}>
            Official downloads for AniNex mobile and cross-fandom infrastructure. Experience the peak of anime connectivity.
          </p>
        </motion.div>

        {/* Main Download Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', width: '100%', maxWidth: '1200px' }}>
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -10 }}
              className="glass-panel"
              style={{ padding: '48px 40px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '56px', marginBottom: '32px' }}>{platform.icon}</div>
              <h3 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>{platform.name}</h3>
              <div style={{ padding: '4px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'inline-block', fontSize: '11px', fontWeight: '700', color: platform.status === 'Stable' ? 'var(--secondary)' : 'rgba(255,255,255,0.3)', marginBottom: '32px', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {platform.status}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                  <span>Version</span>
                  <span style={{ color: '#fff' }}>{platform.version}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                  <span>Release Date</span>
                  <span style={{ color: '#fff' }}>{platform.date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                  <span>File Size</span>
                  <span style={{ color: '#fff' }}>{platform.size}</span>
                </div>
              </div>

              {platform.link !== '#' ? (
                <a
                  href={platform.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-premium"
                  style={{ width: '100%', textDecoration: 'none', background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' }}
                >
                  Download Now
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" /></svg>
                </a>
              ) : (
                <button
                  disabled
                  className="btn-premium btn-secondary"
                  style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}
                >
                  Notify Me
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Patch Logs Section */}
        <div className="glass-panel" style={{ marginTop: '100px', width: '100%', maxWidth: '1000px', padding: '64px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '48px', color: '#fff' }}>Complete <span className="gradient-text">Update Logs</span></h2>

          <div style={{ borderLeft: '2px solid rgba(255,255,255,0.05)', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {[
              { version: 'v1.5.0', date: 'March 04, 2026', notes: ['Critical Push Fix: Single message payload array fix.', 'FCM integration with google-services.json for Android.', 'Gemini 1.5 Pro Personality engine upgrade.'] },
              { version: 'v1.4.0', date: 'March 04, 2026', notes: ['Replaced OpenAI gpt-4o-mini with Gemini 1.5 Pro.', '10-dimension psychological reasoning match system.', 'Multi-device push notification table support.'] },
              { version: 'v1.3.0', date: 'March 02, 2026', notes: ['Centralized useNotifications hook logic.', 'Foreground alert banners and Android channel fixes.', 'Persistent socket listener singleton lock.'] }
            ].map((log, i) => (
              <div key={log.version} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-37px', top: '8px', width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', boxShadow: i === 0 ? '0 0 10px var(--primary)' : 'none' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '20px', fontWeight: '800' }}>{log.version}</h4>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>RELEASED {log.date}</span>
                </div>
                <ul style={{ paddingLeft: '20px', color: 'rgba(255,255,255,0.5)', fontSize: '15px', lineHeight: '1.8' }}>
                  {log.notes.map((note, j) => <li key={j}>{note}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Download;
