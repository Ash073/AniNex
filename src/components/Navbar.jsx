import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navStyles = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: 1000,
    transition: 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
    padding: scrolled ? '12px 6%' : '24px 6%',
    background: scrolled ? 'rgba(2, 6, 23, 0.8)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const menuItems = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Updates', path: '/blogs' },
  ];

  const logoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '22px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    fontFamily: "'Outfit', sans-serif",
  };

  const navLinkStyle = (path) => ({
    color: location.pathname === path ? '#fff' : 'rgba(255, 255, 255, 0.6)',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    position: 'relative',
    padding: '8px 4px',
  });

  return (
    <motion.nav 
      style={navStyles}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
    >
      <Link to="/" style={logoStyle}>
        <div style={{ 
          width: '36px', 
          height: '36px', 
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
        <span className="gradient-text">AniNex</span>
      </Link>

      <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} style={navLinkStyle(item.path)}>
              {item.name}
              {location.pathname === item.path && (
                <motion.div 
                  layoutId="navTab"
                  style={{ 
                    position: 'absolute', 
                    bottom: '0', 
                    left: '0', 
                    right: '0', 
                    height: '2px', 
                    background: 'var(--primary)',
                    borderRadius: '2px' 
                  }}
                />
              )}
            </Link>
          ))}
        </div>

        <Link 
          to="/download" 
          style={{ 
            padding: '10px 24px', 
            borderRadius: '20px', 
            background: 'var(--primary)', 
            color: '#fff', 
            fontSize: '14px', 
            fontWeight: '700',
            boxShadow: '0 8px 16px rgba(124, 58, 237, 0.2)',
            transition: 'all 0.3s ease'
          }}
          className="btn-premium"
        >
          Get App
        </Link>
      </div>
    </motion.nav>
  );
};

export default Navbar;
