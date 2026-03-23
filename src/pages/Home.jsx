import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../components/Layout';
import heroImg from '../assets/hero-app.png';

// Requirement 12 & 13: GitHub Release link variable
const DOWNLOAD_LINK = "https://github.com/Ash073/AniNex/releases/download/v1.5.0/aninex-v1.5.0.apk";

const Home = () => {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.5]);

  return (
    <Layout>
      <div className="mesh-bg"></div>
      <section ref={containerRef} style={{ padding: '0 10%', position: 'relative', minHeight: '130vh' }}>

        {/* Hero Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '100vh', gap: '80px', paddingTop: '80px' }}>
          <motion.div
            style={{ flex: '1.2' }}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
          >
            <div style={{ padding: '8px 16px', borderRadius: '40px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'block' }}></span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: '0.5px' }}>NEXT GENERATION ANIME TECH</span>
            </div>

            <h1 style={{ fontSize: '84px', fontWeight: '900', lineHeight: '0.95', marginBottom: '32px', letterSpacing: '-2.5px', fontFamily: "'Outfit', sans-serif" }}>
              Experience <br /><span className="gradient-text">Anime Connectivity</span> <br />Like Never Before.
            </h1>

            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '56px', lineHeight: '1.6', maxWidth: '580px', fontWeight: '400' }}>
              AniNex is the ultimate mobile communication infrastructure for the global anime community. Seamless, stunning, and built for the future.
            </p>

            <div style={{ display: 'flex', gap: '24px' }}>
              <a
                href={DOWNLOAD_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-premium"
                style={{ textDecoration: 'none' }}
              >
                Download APK
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" /></svg>
              </a>
              <button
                className="btn-premium btn-secondary"
                style={{ background: 'transparent', padding: '16px 40px' }}
              >
                Explore Features
              </button>
            </div>

            <div style={{ marginTop: '64px', display: 'flex', gap: '48px', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>150K+</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>ACTIVE FANS</p>
              </div>
              <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div>
                <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>v1.5.0</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>LATEST STABLE</p>
              </div>
              <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }}></div>
              <div>
                <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>99.9%</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>RELIABILITY</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            style={{ flex: '1', position: 'relative', y: heroY, opacity: heroOpacity }}
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
          >
            <div className="animate-float" style={{ position: 'relative', zIndex: 10 }}>
              <div style={{
                borderRadius: '40px',
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 40px rgba(124, 58, 237, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ background: '#020617', borderRadius: '24px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={heroImg}
                    alt="AniNex Interface"
                    style={{ width: '100%', height: '620px', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '150px', background: 'linear-gradient(to top, #020617, transparent)', pointerEvents: 'none' }}></div>
                </div>
              </div>
            </div>
            {/* Glow spheres */}
            <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(140px)', opacity: '0.15', zIndex: -1 }}></div>
            <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '250px', height: '250px', background: 'var(--secondary)', filter: 'blur(120px)', opacity: '0.1', zIndex: -1 }}></div>
          </motion.div>
        </div>
      </section>

      {/* Floating Features Section */}
      <section style={{ padding: '120px 10%', background: 'linear-gradient(to bottom, #020617, #01040f)' }}>
        <div style={{ textAlign: 'center', marginBottom: '100px' }}>
          <h2 style={{ fontSize: '56px', fontWeight: '900', marginBottom: '24px', letterSpacing: '-1.5px' }}>Re-imagining <span className="cyan-gradient">Engagement</span>.</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>Every detail of AniNex is crafted to feel like a high-end anime OS, merging beauty with peak connectivity.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }}>
          {[
            {
              title: 'Neon Synchrony',
              desc: 'Real-time messaging with low-latency anime emoji engine and custom themes.',
              icon: '⚡',
              accent: 'var(--primary)'
            },
            {
              title: 'Persona Match',
              desc: 'Gemini 1.5 Pro analyzes your traits to find your anime counterpart with psychological precision.',
              icon: '👁️',
              accent: 'var(--accent)'
            },
            {
              title: 'Global Fandom',
              desc: 'Connect with specialized servers across hundreds of fandom categories securely.',
              icon: '🌐',
              accent: 'var(--secondary)'
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -12, scale: 1.02 }}
              className="glass-panel"
              style={{ padding: '56px 40px' }}
            >
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                marginBottom: '32px',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: `0 0 20px ${feature.accent}15`
              }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '16px', letterSpacing: '-0.5px' }}>{feature.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: '1.7', fontSize: '16px' }}>{feature.desc}</p>
              <div style={{ marginTop: '24px', width: '32px', height: '2px', background: feature.accent }}></div>
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Home;
