/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Camera, Phone, MapPin, Upload, X, CheckCircle2, ChevronRight, Star, User, LogOut, LogIn, UserPlus, History, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SLOTS = Array.from({ length: 14 }, (_, i) => i + 9); // 9 AM to 10 PM

export default function App() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookedSlots, setBookedSlots] = useState<number[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [gallery, setGallery] = useState<any[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '' });
  const [isUploading, setIsUploading] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [view, setView] = useState<'home' | 'profile'>('home');
  const [myBookings, setMyBookings] = useState<any[]>([]);

  // WebSocket Ref
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('party_den_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    // Initialize WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.current = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'BOOKING_UPDATE' && data.date === selectedDate) {
        setBookedSlots(prev => [...new Set([...prev, data.slot])]);
      }
    };

    return () => ws.current?.close();
  }, [selectedDate]);

  useEffect(() => {
    fetchBookings();
    fetchGallery();
    if (user) fetchMyBookings();
  }, [selectedDate, user]);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?date=${selectedDate}`);
      const data = await res.json();
      setBookedSlots(data);
    } catch (e) {
      console.error("Failed to fetch bookings", e);
    }
  };

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      const data = await res.json();
      setGallery(data);
    } catch (e) {
      console.error("Failed to fetch gallery", e);
    }
  };

  const fetchMyBookings = async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/my-bookings', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setMyBookings(data);
    } catch (e) {
      console.error("Failed to fetch my bookings", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm),
    });
    
    const data = await res.json().catch(() => ({ error: 'Server error' }));
    if (res.ok) {
      setUser(data);
      localStorage.setItem('party_den_user', JSON.stringify(data));
      setIsAuthModalOpen(false);
      setAuthForm({ email: '', password: '', name: '' });
    } else {
      alert(data.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('party_den_user');
    setView('home');
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlot === null) return;

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...bookingForm, 
        date: selectedDate, 
        slot: selectedSlot,
        token: user?.token 
      }),
    });

    if (res.ok) {
      setIsBookingModalOpen(false);
      setSelectedSlot(null);
      setBookingForm({ name: '', phone: '' });
      fetchBookings();
      if (user) fetchMyBookings();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bookingId?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image_data: base64, 
          caption: bookingId ? `Moment from booking #${bookingId}` : 'New Party Moment',
          bookingId,
          token: user?.token
        }),
      });
      
      if (res.ok) {
        fetchGallery();
      } else {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        alert(data.error);
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500 selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-black text-black">D</div>
            <span className="font-black uppercase tracking-tighter text-xl">The Party Den</span>
          </div>
          
          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView(view === 'home' ? 'profile' : 'home')}
                  className="flex items-center gap-2 text-sm font-mono hover:text-orange-500 transition-colors"
                >
                  <User className="w-4 h-4" /> {user.user.name}
                </button>
                <button onClick={handleLogout} className="p-2 hover:text-red-500 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                className="flex items-center gap-2 text-sm font-mono hover:text-orange-500 transition-colors"
              >
                <LogIn className="w-4 h-4" /> Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div 
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Hero Section */}
            <header className="relative h-[80vh] flex items-center justify-center overflow-hidden border-b border-white/10 pt-20">
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=2070" 
                  alt="Party Background" 
                  className="w-full h-full object-cover opacity-40 scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]" />
              </div>

              <div className="relative z-10 text-center px-4">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center justify-center gap-4"
                >
                  <span className="h-[1px] w-12 bg-orange-500" />
                  <span className="text-orange-500 font-mono tracking-[0.3em] text-sm uppercase">Magic Moments party</span>
                  <span className="h-[1px] w-12 bg-orange-500" />
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-7xl md:text-9xl font-black tracking-tighter uppercase leading-[0.85] mb-8"
                >
                  The Party <br />
                  <span className="text-orange-500">Den</span>
                </motion.h1>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-wrap justify-center gap-6 text-sm font-mono opacity-60"
                >
                  <span className="flex items-center gap-2"><Star className="w-4 h-4" /> Birthdays</span>
                  <span className="flex items-center gap-2"><Star className="w-4 h-4" /> Anniversary</span>
                  <span className="flex items-center gap-2"><Star className="w-4 h-4" /> Mini Theatre</span>
                  <span className="flex items-center gap-2"><Star className="w-4 h-4" /> Photography</span>
                </motion.div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-24 space-y-32">
              {/* Booking Section */}
              <section id="booking" className="grid lg:grid-cols-2 gap-16 items-start">
                <div className="space-y-8">
                  <h2 className="text-5xl font-bold tracking-tight">Reserve Your <br /><span className="italic font-serif text-orange-500">Private Slot</span></h2>
                  <p className="text-white/60 max-w-md leading-relaxed">
                    Experience the ultimate private party destination in Vishakaratnam. 
                    Hourly based bookings starting at just <span className="text-white font-bold">499/- per hour</span>.
                  </p>
                  
                  <div className="space-y-4 pt-8 border-t border-white/10">
                    <div className="flex items-center gap-4 text-white/80">
                      <MapPin className="w-5 h-5 text-orange-500" />
                      <span>Kannayya Nilayam, Neelakundilu Junction, YSR Colony</span>
                    </div>
                    <div className="flex items-center gap-4 text-white/80">
                      <Phone className="w-5 h-5 text-orange-500" />
                      <span>9398572500, 9390832500</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-orange-500" />
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-lg font-bold cursor-pointer"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="text-xs font-mono opacity-40 uppercase tracking-widest">Select Date</div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {SLOTS.map((slot) => {
                      const isBooked = bookedSlots.includes(slot);
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          disabled={isBooked}
                          onClick={() => setSelectedSlot(slot)}
                          className={`
                            py-4 rounded-xl font-mono text-sm transition-all duration-300
                            ${isBooked ? 'bg-white/5 text-white/20 cursor-not-allowed line-through' : 
                              isSelected ? 'bg-orange-500 text-black font-bold shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 
                              'bg-white/10 hover:bg-white/20 text-white/80'}
                          `}
                        >
                          {slot > 12 ? `${slot - 12} PM` : `${slot} ${slot === 12 ? 'PM' : 'AM'}`}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={selectedSlot === null}
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full mt-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:hover:bg-white"
                  >
                    Book Now
                  </button>
                </div>
              </section>

              {/* Gallery Section */}
              <section id="gallery" className="space-y-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-4">
                    <h2 className="text-5xl font-bold tracking-tight">The <span className="text-orange-500 italic font-serif">Den</span> Gallery</h2>
                    <p className="text-white/60">Capture and share your magic moments with us.</p>
                  </div>
                  
                  <label className="group relative flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-full cursor-pointer hover:bg-white/10 transition-all">
                    <Upload className={`w-5 h-5 text-orange-500 ${isUploading ? 'animate-bounce' : ''}`} />
                    <span className="text-sm font-bold uppercase tracking-wider">Upload Moment</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e)} disabled={isUploading} />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gallery.map((item) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={item.id} 
                      className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/5 border border-white/10"
                    >
                      <img src={item.image_data} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex items-end">
                        <p className="text-sm font-mono">{item.caption}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            </main>
          </motion.div>
        ) : (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-7xl mx-auto px-6 py-32 space-y-16"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-8">
              <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter">User Profile</h2>
                <p className="text-white/40 font-mono text-sm mt-2">{user.user.email}</p>
              </div>
              <div className="text-right">
                <div className="text-orange-500 font-black text-3xl">{myBookings.length}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest opacity-40">Total Bookings</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-8">
                <div className="flex items-center gap-3 text-orange-500">
                  <History className="w-5 h-5" />
                  <h3 className="font-bold uppercase tracking-widest text-sm">Booking History</h3>
                </div>
                
                <div className="space-y-4">
                  {myBookings.map((booking) => (
                    <div key={booking.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group hover:border-orange-500/50 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-bold text-orange-500">
                          {booking.slot > 12 ? `${booking.slot - 12}P` : `${booking.slot}A`}
                        </div>
                        <div>
                          <div className="font-bold">{booking.date}</div>
                          <div className="text-xs font-mono opacity-40">Booking ID: #{booking.id}</div>
                        </div>
                      </div>
                      
                      <label className="cursor-pointer p-3 bg-white/5 rounded-full hover:bg-orange-500 hover:text-black transition-all">
                        <ImageIcon className="w-5 h-5" />
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, booking.id)} />
                      </label>
                    </div>
                  ))}
                  {myBookings.length === 0 && (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10 opacity-40 font-mono text-sm">
                      No bookings found yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-3 text-orange-500">
                  <ImageIcon className="w-5 h-5" />
                  <h3 className="font-bold uppercase tracking-widest text-sm">My Uploads</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {gallery.filter(img => img.user_id === user.user.id).map(img => (
                    <div key={img.id} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                      <img src={img.image_data} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 text-center text-white/40 text-xs font-mono uppercase tracking-[0.2em]">
        &copy; 2026 The Party Den &bull; Magic Moments &bull; Vishakaratnam
      </footer>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#111] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">
                {authMode === 'login' ? 'Welcome Back' : 'Join The Den'}
              </h3>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest mb-8">
                {authMode === 'login' ? 'Enter your credentials' : 'Create your account'}
              </p>

              <form onSubmit={handleAuth} className="space-y-6">
                {authMode === 'register' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase opacity-40 tracking-widest">Name</label>
                    <input 
                      required
                      type="text" 
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 focus:ring-0 transition-colors"
                      placeholder="Your Name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase opacity-40 tracking-widest">Email</label>
                  <input 
                    required
                    type="email" 
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="den@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase opacity-40 tracking-widest">Password</label>
                  <input 
                    required
                    type="password" 
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-orange-500 transition-colors flex items-center justify-center gap-2"
                >
                  {authMode === 'login' ? 'Login' : 'Register'} <ChevronRight className="w-5 h-5" />
                </button>

                <div className="text-center pt-4">
                  <button 
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="text-xs font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                  >
                    {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <button 
                onClick={() => setIsBookingModalOpen(false)}
                className="absolute top-6 right-6 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Confirm Booking</h3>
                <div className="flex items-center gap-4 text-orange-500 font-mono text-sm">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {selectedDate}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> 
                    {selectedSlot! > 12 ? `${selectedSlot! - 12} PM` : `${selectedSlot!} ${selectedSlot === 12 ? 'PM' : 'AM'}`}
                  </span>
                </div>
              </div>

              <form onSubmit={handleBooking} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase opacity-40">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase opacity-40">Phone Number</label>
                  <input 
                    required
                    type="tel" 
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 focus:ring-0 transition-colors"
                    placeholder="+91 00000 00000"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-4 bg-orange-500 text-black font-black uppercase tracking-widest rounded-xl hover:bg-orange-400 transition-colors flex items-center justify-center gap-2"
                >
                  Confirm & Pay <CheckCircle2 className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
