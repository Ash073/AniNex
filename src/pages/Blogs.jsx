import React from 'react';
import Layout from '../components/Layout';
import { motion } from 'framer-motion';

const blogsData = [
  {
    date: 'March 04, 2026',
    title: 'AniNex 1.5.0: Critical Push Fixes',
    desc: 'Resolved the core issue with Expo Push delivering to Android devices. Updated pushSender logic and added FCM integration for 100% deliverability.',
    category: 'Production'
  },
  {
    date: 'March 04, 2026',
    title: 'Gemini 1.5 Pro Personality Engine',
    desc: 'Upgraded AI Matching from GPT-4o-mini to Google Gemini 1.5 Pro. Now features deep psychological reasoning across 10 dimensions for a perfect character match.',
    category: 'AI / Feature'
  },
  {
    date: 'March 04, 2026',
    title: 'Notification System V3 Rebuild',
    desc: 'Full notification architecture overhaul with 3-layer deduplication, multi-device support, and sliding window rate limiting for a spam-free experience.',
    category: 'Infrastructure'
  },
  {
    date: 'March 02, 2026',
    title: 'Premium Daily Anime Facts',
    desc: 'Switched to a stable API Ninjas infrastructure for daily facts. Added a dedicated full-screen modal with zero truncation and premium aesthetics.',
    category: 'Engagement'
  }
];

const Blogs = () => {
  return (
    <Layout>
      <section style={{ padding: '80px 10%' }}>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ fontSize: '64px', fontWeight: '800', textAlign: 'center', marginBottom: '100px' }}
        >
          Latest <span className="gradient-text">Updates & Logs</span>
        </motion.h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '60px', maxWidth: '900px', margin: '0 auto' }}>
          {blogsData.map((blog, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ 
                display: 'flex', 
                gap: '40px', 
                padding: '40px', 
                borderRadius: '32px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                alignItems: 'center'
              }}
              whileHover={{ scale: 1.02, background: 'rgba(255, 255, 255, 0.05)' }}
            >
              <div style={{ flex: 1 }}>
                 <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>{blog.category}</span>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>&bull; {blog.date}</span>
                 </div>
                 <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '16px', color: '#f1f5f9' }}>{blog.title}</h2>
                 <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: '1.6', marginBottom: '30px' }}>{blog.desc}</p>
                 <button style={{ color: 'var(--secondary)', fontWeight: '700', background: 'none', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Read full log &rarr;
                 </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Blogs;
