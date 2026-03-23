import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Rocket } from 'lucide-react';

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

  const menuItems = [
    { name: 'HOME', path: '/' },
    { name: 'ABOUT', path: '/about' },
    { name: 'UPDATES', path: '/blogs' },
    { name: 'DOWNLOAD', path: '/download' },
  ];

  return (
    <div style={{ 
      position: 'fixed', 
      top: '0', 
      left: '0', 
      right: '0', 
      zIndex: 1000, 
      padding: '24px 6%', 
      display: 'flex', 
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ 
          background: 'rgba(15, 23, 42, 0.7)', 
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '100px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          pointerEvents: 'auto'
        }}
      >
        {/* Logo */}
        <Link to="/" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '0 12px',
          textDecoration: 'none'
        }}>
          <img src="/adaptive-icon.png" alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
          <span className="gradient-text" style={{ fontSize: '13px', fontWeight: 'bold', fontFamily: "'Syncopate', sans-serif", letterSpacing: '1px' }}>ANINEX</span>
        </Link>

        {/* Desktop Links */}
        <div style={{ display: 'flex', gap: '4px' }} className="navbar-desktop">
           {menuItems.map((item) => (
             <Link 
               key={item.path} 
               to={item.path} 
               style={{ 
                 textDecoration: 'none', 
                 color: location.pathname === item.path ? '#fff' : 'rgba(255,255,255,0.4)', 
                 padding: '8px 16px', 
                 borderRadius: '100px',
                 fontSize: '11px',
                 fontWeight: '700',
                 letterSpacing: '1.5px',
                 background: location.pathname === item.path ? 'rgba(255,255,255,0.05)' : 'transparent',
                 transition: 'all 0.3s ease',
                 fontFamily: "'Rajdhani', sans-serif",
                 textTransform: 'uppercase'
               }}
             >
               {item.name}
             </Link>
           ))}
        </div>

        {/* Get App Button */}
        <Link 
          to="/download" 
          className="navbar-desktop"
          style={{ 
            textDecoration: 'none',
            background: 'var(--primary)',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: '900',
            letterSpacing: '1.5px',
            boxShadow: '0 10px 20px rgba(124, 58, 237, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Syncopate', sans-serif"
          }}
        >
          <Rocket size={12}/>
          JOIN
        </Link>

        {/* Mobile Toggle */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="navbar-mobile-toggle"
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#fff', 
            padding: '8px 12px', 
            display: 'none',
            cursor: 'pointer'
          }}
        >
          {isOpen ? <X size={24}/> : <Menu size={24}/>}
        </button>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ 
              position: 'fixed', 
              top: '100px', 
              left: '20px', 
              right: '20px', 
              background: 'rgba(15, 23, 42, 0.95)', 
              backdropFilter: 'blur(30px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
              pointerEvents: 'auto',
              textAlign: 'center'
            }}
          >
            {menuItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsOpen(false)}
                style={{ 
                  textDecoration: 'none', 
                  color: '#fff', 
                  fontSize: '20px', 
                  fontWeight: '700',
                  letterSpacing: '2px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: location.pathname === item.path ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255,255,255,0.02)',
                  fontFamily: "'Syncopate', sans-serif"
                }}
              >
                {item.name}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Navbar;
