import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("partyhouse.db");
const JWT_SECRET = process.env.JWT_SECRET || "party-den-secret-key-123";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    slot INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    booking_id INTEGER,
    image_data TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
  );
`);

// Migration: Add missing columns if they don't exist
const migrate = () => {
  const bookingsInfo = db.prepare("PRAGMA table_info(bookings)").all();
  const hasUserIdInBookings = bookingsInfo.some((col: any) => col.name === 'user_id');
  if (!hasUserIdInBookings) {
    db.exec("ALTER TABLE bookings ADD COLUMN user_id INTEGER REFERENCES users(id)");
  }

  const galleryInfo = db.prepare("PRAGMA table_info(gallery)").all();
  const hasUserIdInGallery = galleryInfo.some((col: any) => col.name === 'user_id');
  if (!hasUserIdInGallery) {
    db.exec("ALTER TABLE gallery ADD COLUMN user_id INTEGER REFERENCES users(id)");
  }
  const hasBookingIdInGallery = galleryInfo.some((col: any) => col.name === 'booking_id');
  if (!hasBookingIdInGallery) {
    db.exec("ALTER TABLE gallery ADD COLUMN booking_id INTEGER REFERENCES bookings(id)");
  }
};

migrate();

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // WebSocket Broadcast Helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
      const result = stmt.run(email, hashedPassword, name);
      const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, email, name } });
    } catch (error) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  // Booking Routes
  app.get("/api/bookings", (req, res) => {
    const { date } = req.query;
    const stmt = db.prepare("SELECT slot FROM bookings WHERE date = ?");
    const bookedSlots = stmt.all(date).map((row: any) => row.slot);
    res.json(bookedSlots);
  });

  app.get("/api/my-bookings", authenticateToken, (req: any, res) => {
    const stmt = db.prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC");
    res.json(stmt.all(req.user.id));
  });

  app.post("/api/bookings", async (req: any, res) => {
    const { name, phone, date, slot, token } = req.body;
    let userId = null;
    
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {}
    }

    try {
      const stmt = db.prepare("INSERT INTO bookings (user_id, name, phone, date, slot) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(userId, name, phone, date, slot);
      
      // Broadcast update to all clients
      broadcast({ type: 'BOOKING_UPDATE', date, slot });
      
      res.json({ success: true, bookingId: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Booking failed" });
    }
  });

  // Gallery Routes
  app.get("/api/gallery", (req, res) => {
    const { bookingId } = req.query;
    let stmt;
    if (bookingId) {
      stmt = db.prepare("SELECT * FROM gallery WHERE booking_id = ? ORDER BY created_at DESC");
      res.json(stmt.all(bookingId));
    } else {
      stmt = db.prepare("SELECT * FROM gallery ORDER BY created_at DESC");
      res.json(stmt.all());
    }
  });

  app.post("/api/gallery", async (req: any, res) => {
    const { image_data, caption, bookingId, token } = req.body;
    let userId = null;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {}
    }

    try {
      const stmt = db.prepare("INSERT INTO gallery (user_id, booking_id, image_data, caption) VALUES (?, ?, ?, ?)");
      stmt.run(userId, bookingId || null, image_data, caption);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
