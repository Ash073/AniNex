import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Rocket, Target, Cpu, Users } from 'lucide-react';

const About = () => {
  return (
    <Layout>
      <div className="mesh-bg"></div>
      <section style={{ padding: '80px 10%', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', position: 'relative', zIndex: 10 }}>
        
        {/* Glow Core */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', background: 'var(--primary)', filter: 'blur(150px)', opacity: '0.1', zIndex: -1 }}></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2 }}
          style={{ textAlign: 'center', marginBottom: '100px' }}
        >
          <h1 style={{ fontSize: '72px', fontWeight: '900', marginBottom: '24px', letterSpacing: '-2px', fontFamily: "'Syncopate', sans-serif" }}>
            The <span className="gradient-text">AniNex</span> Vision
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-sub)', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Building the most advanced communication infrastructure specifically for the global anime FANDOM.
          </p>
        </motion.div>

        {/* Vision Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', width: '100%', maxWidth: '1200px' }} className="grid-3">
          {[
            { 
              title: 'Our Mission', 
              desc: 'To provide a seamless, low-latency communication layer that connects millions of anime fans through high-performance tech and stunning UI.', 
              icon: <Target size={32} color="var(--primary)"/> 
            },
            { 
              title: 'Tech First', 
              desc: 'AniNex is built on modern protocols ensuring your messages, voice-rooms, and watch-parties are delivered at the speed of light.', 
              icon: <Cpu size={32} color="var(--secondary)"/> 
            }
          ].map((card, i) => (
            <motion.div 
               key={i}
               initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
               animate={{ opacity: 1, x: 0 }}
               className="glass-panel"
               style={{ padding: '60px 48px' }}
            >
               <div style={{ marginBottom: '32px' }}>{card.icon}</div>
               <h3 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px', letterSpacing: '1px', fontFamily: "'Syncopate', sans-serif" }}>{card.title}</h3>
               <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', lineHeight: '1.8', fontFamily: 'var(--font-sub)' }}>{card.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Community Focus */}
        <section style={{ marginTop: '120px', textAlign: 'center' }}>
          <div style={{ padding: '80px', borderRadius: '40px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '1000px', margin: '0 auto' }}>
             <Users size={64} color="var(--accent)" style={{ marginBottom: '40px' }}/>
             <h2 style={{ fontSize: '42px', fontWeight: '900', marginBottom: '32px', fontFamily: "'Syncopate', sans-serif" }}>Built by <span className="gradient-text">FANS</span> for <span className="gradient-text">FANS</span>.</h2>
             <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: '1.8', maxWidth: '700px', margin: '0 auto 64px', fontFamily: 'var(--font-sub)' }}>
               Every pixel of AniNex is crafted with love for the community. We understand what it means to be a fan, so we build the tools we always wanted.
             </p>
             
             {/* Requirement: Redirect to download screen */}
             <Link 
               to="/download" 
               className="btn-premium"
               style={{ 
                 display: 'inline-flex', 
                 textDecoration: 'none', 
                 margin: '0 auto', 
                 padding: '20px 60px', 
                 fontSize: '16px', 
                 boxShadow: '0 20px 40px rgba(124, 58, 237, 0.4)' 
               }}
             >
               <Rocket size={20}/>
               GET STARTED NOW
             </Link>
          </div>
        </section>
      </section>
    </Layout>
  );
};

export default About;
