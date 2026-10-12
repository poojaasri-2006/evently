import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  ClipboardList,
  FileText,
  MessageCircle,
  Wallet,
  Bell,
  CalendarDays,
  CheckCircle,
  Users,
  Zap,
  ShieldCheck,
  ArrowRight,
  Heart,
} from 'lucide-react';
import { Button } from '../components/Button';

const fadeKeyframes = `
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-14px); }
  }
  @keyframes pulseRing {
    0% { box-shadow: 0 20px 40px rgba(181, 98, 109, 0.25); }
    50% { box-shadow: 0 28px 60px rgba(181, 98, 109, 0.4); }
    100% { box-shadow: 0 20px 40px rgba(181, 98, 109, 0.25); }
  }
  .landing-feature:hover {
    transform: translateY(-6px);
    box-shadow: var(--shadow-soft);
  }
`;

const sectionHeading = (eyebrow, title, subtitle) => (
  <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3.5rem' }}>
    <span className="chip" style={{ marginBottom: '1rem', display: 'inline-flex' }}>{eyebrow}</span>
    <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, lineHeight: 1.2 }}>{title}</h2>
    <p style={{ fontSize: '1.05rem', marginTop: '0.75rem' }}>{subtitle}</p>
  </div>
);

const featureCard = (Icon, title, description, delay) => (
  <div
    className="landing-feature"
    style={{
      backgroundColor: 'var(--card-white)',
      borderRadius: 'var(--radius-large)',
      padding: '2rem',
      boxShadow: 'var(--shadow-sm)',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      animation: `fadeUp 0.6s ease ${delay}s both`,
    }}
  >
    <div
      style={{
        width: '52px',
        height: '52px',
        borderRadius: '16px',
        backgroundColor: 'var(--primary-rose-tint)',
        color: 'var(--primary-rose)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.25rem',
      }}
    >
      <Icon size={26} strokeWidth={1.8} />
    </div>
    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{title}</h3>
    <p style={{ fontSize: '0.95rem' }}>{description}</p>
  </div>
);

const stepItem = (Icon, step, title, description, delay) => (
  <div
    style={{
      flex: '1 1 240px',
      backgroundColor: 'var(--card-white)',
      borderRadius: 'var(--radius-large)',
      padding: '2rem',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      animation: `fadeUp 0.6s ease ${delay}s both`,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '-14px',
        left: '1.5rem',
        backgroundColor: 'var(--primary-rose)',
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.8rem',
        padding: '0.25rem 0.75rem',
        borderRadius: 'var(--radius-pill)',
        letterSpacing: '0.05em',
      }}
    >
      STEP {step}
    </span>
    <Icon size={30} strokeWidth={1.8} color="var(--primary-rose)" style={{ marginTop: '0.75rem', marginBottom: '1rem' }} />
    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{title}</h3>
    <p style={{ fontSize: '0.95rem' }}>{description}</p>
  </div>
);

export const LandingPage = () => {
  // Splash screen: logo for ~1s, then fade into the landing page
  const [splash, setSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 1000);
    const removeTimer = setTimeout(() => setSplash(false), 1500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#fff', minHeight: '100vh' }}>
      <style>{fadeKeyframes}</style>

      {/* Splash screen overlay */}
      {splash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: fadeOut ? 0 : 1,
            transition: 'opacity 0.5s ease',
            pointerEvents: fadeOut ? 'none' : 'auto',
          }}
        >
          <div
            style={{
              width: 'clamp(220px, 30vw, 320px)',
              height: 'clamp(220px, 30vw, 320px)',
              background: 'linear-gradient(135deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              animation: 'pulseRing 5s ease-in-out infinite',
            }}
          >
            <h1
              style={{
                color: '#fff',
                fontFamily: "'Great Vibes', cursive",
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 7vw, 5.5rem)',
                margin: 0,
                userSelect: 'none',
                lineHeight: 1,
                textShadow: '0 4px 20px rgba(0,0,0,0.12)',
              }}
            >
              Evently
            </h1>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          padding: '1rem 5%',
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--surface-soft)',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ color: '#fff', fontFamily: "'Great Vibes', cursive", fontSize: '1.5rem', lineHeight: 1 }}>
              E
            </span>
          </div>
          <span style={{ fontWeight: 600, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Evently</span>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Button variant="outline">Log In</Button>
          </Link>
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <Button variant="primary">Sign Up</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ padding: '4rem 5% 3rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '3rem',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div style={{ flex: '1 1 380px', animation: 'fadeUp 0.6s ease both' }}>
            <span className="chip" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
              <Heart size={14} style={{ marginRight: '6px' }} /> Event vendor management
            </span>
            <h1
              style={{
                fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)',
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                marginBottom: '1.25rem',
              }}
            >
              Plan your perfect event,{' '}
              <span
                style={{
                  fontFamily: "'Great Vibes', cursive",
                  fontWeight: 400,
                  color: 'var(--primary-rose)',
                  fontSize: 'clamp(2.5rem, 6vw, 4.25rem)',
                }}
              >
                beautifully
              </span>
            </h1>
            <p style={{ fontSize: '1.1rem', maxWidth: '520px', marginBottom: '2rem' }}>
              Evently brings vendors, quotes, bookings, messaging, and budgets together in one
              place — so you can stop juggling spreadsheets and start enjoying the planning.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/register" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ padding: '0.9rem 2rem', fontSize: '1.05rem' }}>
                  Get Started Free <ArrowRight size={18} style={{ marginLeft: '6px' }} />
                </Button>
              </Link>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="outline" style={{ padding: '0.9rem 2rem', fontSize: '1.05rem' }}>
                  I'm a returning planner
                </Button>
              </Link>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '2rem',
                marginTop: '2.5rem',
                flexWrap: 'wrap',
              }}
            >
              {[
                { Icon: Users, label: 'Organizers & vendors', sub: 'one shared platform' },
                { Icon: Zap, label: 'Instant quotes', sub: 'real-time responses' },
                { Icon: ShieldCheck, label: 'Secure accounts', sub: 'role-based access' },
              ].map(({ Icon, label, sub }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--primary-rose-tint)',
                      color: 'var(--primary-rose)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={19} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logo centerpiece */}
          <div
            style={{
              flex: '0 1 340px',
              display: 'flex',
              justifyContent: 'center',
              animation: 'fadeUp 0.8s ease 0.15s both',
            }}
          >
            <div
              style={{
                width: 'clamp(220px, 30vw, 320px)',
                height: 'clamp(220px, 30vw, 320px)',
                background: 'linear-gradient(135deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                animation: 'floatSlow 6s ease-in-out infinite, pulseRing 5s ease-in-out infinite',
              }}
            >
              <h1
                style={{
                  color: '#fff',
                  fontFamily: "'Great Vibes', cursive",
                  fontWeight: 400,
                  fontSize: 'clamp(3.5rem, 7vw, 5.5rem)',
                  margin: 0,
                  userSelect: 'none',
                  lineHeight: 1,
                  textShadow: '0 4px 20px rgba(0,0,0,0.12)',
                }}
              >
                Evently
              </h1>
            </div>
          </div>
        </div>
      </main>

      {/* Features */}
      <section style={{ padding: '4rem 5%', backgroundColor: 'var(--surface-soft)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {sectionHeading(
            'WHY EVENTLY',
            'Everything your event needs, in one place',
            'From your first vendor search to the final booking, Evently keeps every detail organized.'
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {featureCard(Search, 'Discover Vendors', 'Browse vetted vendors by category, city, and price — with photos and reviews to help you choose.', 0)}
            {featureCard(ClipboardList, 'Shortlist & Compare', 'Save your favorites to a shortlist and compare services, packages, and pricing side by side.', 0.08)}
            {featureCard(FileText, 'Quotes & Bookings', 'Request quotes, negotiate terms, and confirm bookings without ever leaving the app.', 0.16)}
            {featureCard(MessageCircle, 'Real-time Messaging', 'Chat with vendors instantly — questions, revisions, and final details, all in one thread.', 0.24)}
            {featureCard(Wallet, 'Budget Tracking', 'Set a total budget and track every line item against it, so there are no surprise costs.', 0.32)}
            {featureCard(Bell, 'Smart Notifications', 'Get notified the moment a vendor responds, a quote arrives, or a booking updates.', 0.4)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4.5rem 5%', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {sectionHeading(
            'HOW IT WORKS',
            'From idea to event in three steps',
            'No spreadsheets, no endless email threads — just a clear path from planning to party.'
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {stepItem(CalendarDays, 1, 'Create your event', 'Add the date, venue, and vision. Describe what you need and set your budget in minutes.', 0)}
            {stepItem(Search, 2, 'Discover & shortlist', 'Find vendors that match your style, shortlist your favorites, and compare them head to head.', 0.12)}
            {stepItem(CheckCircle, 3, 'Book with confidence', 'Review quotes, chat with vendors, and confirm your picks — all tracked in one dashboard.', 0.24)}
          </div>
        </div>
      </section>

      {/* Vendor CTA */}
      <section style={{ padding: '4rem 5%', backgroundColor: 'var(--primary-rose-tint)' }}>
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '2rem',
          }}
        >
          <div style={{ flex: '1 1 320px' }}>
            <span className="chip" style={{ marginBottom: '1rem', display: 'inline-flex' }}>FOR VENDORS</span>
            <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 700, marginBottom: '0.75rem' }}>
              Are you a vendor? Grow your business with Evently.
            </h2>
            <p style={{ fontSize: '1.05rem', marginBottom: '1.75rem' }}>
              Create a profile, showcase your services and packages, manage availability, send quotes,
              and get booked — all from a simple vendor dashboard.
            </p>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ padding: '0.9rem 2rem', fontSize: '1.05rem' }}>
                Join as a Vendor <ArrowRight size={18} style={{ marginLeft: '6px' }} />
              </Button>
            </Link>
          </div>
          <div style={{ flex: '0 1 300px', display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                backgroundColor: 'var(--card-white)',
                boxShadow: 'var(--shadow-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'floatSlow 6s ease-in-out infinite',
              }}
            >
              <span style={{ fontFamily: "'Great Vibes', cursive", fontSize: '3.5rem', color: 'var(--primary-rose)' }}>
                &
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: '5rem 5%',
          background: 'linear-gradient(135deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <span
            style={{
              fontFamily: "'Great Vibes', cursive",
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              color: 'rgba(255,255,255,0.95)',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            Let's celebrate
          </span>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', marginBottom: '2rem' }}>
            Your next event deserves a smoother plan. Create a free account and start discovering
            vendors today.
          </p>
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <Button
              variant="outline"
              style={{
                padding: '0.9rem 2.25rem',
                fontSize: '1.05rem',
                color: '#fff',
                borderColor: '#fff',
                backgroundColor: 'rgba(255,255,255,0.12)',
              }}
            >
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '2.5rem 5%',
          backgroundColor: 'var(--text-primary)',
          color: 'rgba(255,255,255,0.75)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontFamily: "'Great Vibes', cursive", fontSize: '1.6rem', color: '#fff' }}>Evently</span>
          <span style={{ fontSize: '0.85rem' }}>— event vendor management</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>Log In</Link>
          <Link to="/register" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>Sign Up</Link>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
          © {new Date().getFullYear()} Evently
        </div>
      </footer>
    </div>
  );
};
