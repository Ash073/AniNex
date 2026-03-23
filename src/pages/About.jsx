import React from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';

const About = () => {
  return (
    <Layout>
      <section style={{ padding: '80px 10%' }}>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ fontSize: '64px', fontWeight: '800', textAlign: 'center', marginBottom: '80px' }}
        >
          About <span className="gradient-text">AniNex</span>
        </motion.h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '80px', maxWidth: '1200px', margin: '0 auto', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '24px' }}>Our <span className="gradient-text">Vision</span></h2>
            <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: '1.8', marginBottom: '24px' }}>
              AniNex was born from the desire to create a communication hub specifically tailored for the needs of anime fans.
              Traditional communication tools were too generic; we wanted something that felt like it belonged in the same universe
              as the shows we love.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: '1.8' }}>
              We're building more than just an app; we're building the infrastructure that connects the next billion anime fans
              with high-performance, low-latency communication tech and stunning anime-tech visuals.
            </p>
          </div>
          
          <div style={{ borderRadius: '40px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255,255,255,0.03)', padding: '60px' }}>
             <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '32px' }}>Anime-Tech Stack</h2>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { label: 'Real-time Sync', val: '99.9%' },
                  { label: 'Chat Latency', val: '<5ms' },
                  { label: 'Community size', val: '150k+' },
                  { label: 'Open Source', val: 'Yes' }
                ].map((stat, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '15px' }}>
                    <span style={{ color: '#64748b', fontSize: '16px' }}>{stat.label}</span>
                    <span style={{ color: 'var(--secondary)', fontWeight: '700', fontSize: '16px' }}>{stat.val}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '100px 10%', textAlign: 'center' }}>
        <h2 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '24px' }}>Ready to join the <br/><span className="gradient-text">Future?</span></h2>
        <p style={{ color: '#94a3b8', fontSize: '20px', marginBottom: '40px' }}>Experience anime communication at its absolute peak.</p>
        <button style={{ padding: '20px 60px', borderRadius: '40px', background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)', color: 'white', fontWeight: '800', fontSize: '20px', boxShadow: '0 10px 40px rgba(124, 58, 237, 0.4)' }} className="neon-shadow">
          Get Started Now
        </button>
      </section>
    </Layout>
  );
};

export default About;
