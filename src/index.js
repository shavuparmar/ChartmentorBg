const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();

/* -----------------------------
   SECURITY MIDDLEWARES
------------------------------*/

// Helmet (security headers)
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

// Allowed origins (IMPORTANT FIX)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://chartmentor.vercel.app",
  "http://localhost:5173"
].filter(Boolean);

// CORS CONFIG (FIXED)
app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman / server-to-server
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Handle preflight requests (VERY IMPORTANT)
app.options("*", cors());

/* -----------------------------
   BASIC MIDDLEWARES
------------------------------*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logger (only in dev recommended)
app.use(morgan('dev'));

/* -----------------------------
   RATE LIMITING
------------------------------*/

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later"
  }
});

app.use('/api/', apiLimiter);

/* -----------------------------
   ROUTES
------------------------------*/

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/student', require('./routes/student.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/plan', require('./routes/plan.routes'));

/* -----------------------------
   HEALTH CHECK ROUTE
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
  console.error("❌ Error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

/* -----------------------------
   START SERVER
------------------------------*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});