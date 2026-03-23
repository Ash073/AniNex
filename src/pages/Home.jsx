import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../components/Layout';
import { Zap, Brain, Globe, Download, Info, Users, Activity, Cpu } from 'lucide-react';

const DOWNLOAD_LINK = "https://github.com/Ash073/AniNex/releases/download/v1.5.0/aninex-v1.5.0.apk";

const Home = () => {
  return (
    <Layout>
      <section style={{ 
        padding: '0 10%', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow Core */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            width: '600px', 
            height: '600px', 
            background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)', 
            opacity: 0.15, 
            filter: 'blur(60px)',
            zIndex: -1
          }}
        />

        {/* Floating Abstract Element */}
        <motion.div 
           initial={{ opacity: 0, y: 50 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
           style={{ marginBottom: '40px' }}
        >
           <div style={{ 
             width: '120px', 
             height: '120px', 
             borderRadius: '50%', 
             border: '2px solid var(--primary)', 
             display: 'flex', 
             alignItems: 'center', 
             justifyContent: 'center',
             background: 'rgba(255, 255, 255, 0.03)',
             backdropFilter: 'blur(10px)',
             position: 'relative'
           }}>
              <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                 style={{ 
                   position: 'absolute', 
                   top: '-5px', 
                   left: '-5px', 
                   right: '-5px', 
                   bottom: '-5px', 
                   borderRadius: '50%', 
                   border: '2px solid transparent',
                   borderTop: '2px solid var(--secondary)',
                   borderBottom: '2px solid var(--accent)'
                 }}
              />
              <img src="/adaptive-icon.png" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
           </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
          style={{ 
            fontSize: '96px', 
            lineHeight: '0.85', 
            marginBottom: '32px', 
            fontFamily: "'Syncopate', sans-serif", 
            fontWeight: 'bold',
            letterSpacing: '-5px' 
          }}
        >
          CONNECTING <br/><span className="gradient-text">THE FUTURE</span> <br/>OF ANIME.
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4 }}
          style={{ 
            fontSize: '22px', 
            color: 'rgba(255, 255, 255, 0.5)', 
            marginBottom: '64px', 
            maxWidth: '800px', 
            lineHeight: '1.6',
            fontWeight: '400',
            fontFamily: 'var(--font-sub)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}
        >
          State-of-the-art communication infrastructure <br/>tailored specifically for the global anime FANDOM.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.6 }}
          style={{ display: 'flex', gap: '32px', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <a 
            href={DOWNLOAD_LINK}
            className="btn-premium"
            style={{ textDecoration: 'none', minWidth: '240px' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={20} />
            GET ANDROID APK
          </a>
          <button 
            className="btn-premium btn-secondary"
            style={{ minWidth: '240px' }}
          >
            <Info size={20} />
            EXPLORE TECH
          </button>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 2, delay: 1 }}
           style={{ marginTop: '100px', display: 'flex', gap: '80px', flexWrap: 'wrap', justifyContent: 'center' }}
        >
           {[
             { val: '150K+', label: 'Active Sessions', icon: <Users size={20} color="var(--primary)"/> },
             { val: 'v1.5.0', label: 'Latest Build', icon: <Activity size={20} color="var(--secondary)"/> },
             { val: '1ms', label: 'Latency', icon: <Cpu size={20} color="var(--accent)"/> }
           ].map((stat) => (
             <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '12px' }}>{stat.icon}</div>
                <h4 style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-sub)', letterSpacing: '2px' }}>{stat.val}</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>{stat.label}</p>
             </div>
           ))}
        </motion.div>
      </section>

      {/* Grid Display Section (Responsive) */}
      <section style={{ padding: '120px 10%' }}>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px' }} className="grid-3">
            {[
              { title: 'Neon Protocol', desc: 'Secure, low-latency communication layer built for speed.', icon: <Zap size={40} color="var(--primary)"/> },
              { title: 'Persona Sync', desc: 'Find your fandom matched community with Gemini AI.', icon: <Brain size={40} color="var(--secondary)"/> },
              { title: 'Global Grid', desc: 'Access anime-specific nodes across the cloud instantly.', icon: <Globe size={40} color="var(--accent)"/> }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10, background: 'rgba(255,255,255,0.05)' }}
                className="glass-panel"
                style={{ padding: '60px 40px', transition: 'all 0.3s ease' }}
              >
                <div style={{ marginBottom: '32px' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '16px', letterSpacing: '0.5px' }}>{feature.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', lineHeight: '1.7', fontSize: '15px', fontFamily: 'var(--font-sub)' }}>{feature.desc}</p>
              </motion.div>
            ))}
         </div>
      </section>
    </Layout>
  );
};

export default Home;
