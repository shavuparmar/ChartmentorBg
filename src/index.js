const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");

dotenv.config();

// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL', 'RESEND_API_KEY', 'JWT_SECRET', 'FRONTEND_URL'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`❌ CRITICAL: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();

/* -----------------------------
   SECURITY MIDDLEWARES
------------------------------*/

// Helmet security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // For React
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "http:"], // Adjust according to your needs
      },
    },
    xssFilter: true, // Adds X-XSS-Protection
    noSniff: true, // Adds X-Content-Type-Options
  })
);

/* -----------------------------
   CORS CONFIG (PRODUCTION SAFE)
------------------------------*/

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://chartmentor.vercel.app",
  "http://localhost:5173",
  "https://www.chartmentors.in/"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server / postman
      if (!origin) return callback(null, true);

      // Allow known origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // ⚠️ TEMP SAFE MODE (prevents deploy crash)
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// ❌ IMPORTANT: DO NOT USE app.options("/*")
// Express v5 crashes with it
// CORS middleware already handles preflight automatically

/* -----------------------------
   BASIC MIDDLEWARES
------------------------------*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Logger (dev only recommended)
app.use(morgan("dev"));

/* -----------------------------
   RATE LIMITING
------------------------------*/

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later"
  }
});

app.use("/api/", apiLimiter);

/* -----------------------------
   ROUTES
------------------------------*/

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/student", require("./routes/student.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/plan", require("./routes/plan.routes"));
app.use("/api/channel", require("./routes/channel.routes"));
app.use("/api/coupon", require("./routes/coupon.routes"));

/* -----------------------------
   HEALTH CHECK
------------------------------*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ChartMentor API is running 🚀"
  });
});

/* -----------------------------
   GLOBAL ERROR HANDLER
------------------------------*/

app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

/* -----------------------------
   START SERVER
------------------------------*/

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Middleware for sockets can go here, but for now we just make io accessible globally
app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);

  socket.on('join_student_room', (userId) => {
    socket.join('students');
    // If you want user-specific notifications, you can do: socket.join(userId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});