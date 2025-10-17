const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });

exports.signup = async (req, res) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const exists = await User.findOne({ email: parsed.email });
    if (exists) return res.status(409).json({ message: 'Email already in use' });
    const user = await User.create(parsed);
    const token = signToken(user);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: 'Signup error', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const matched = await user.comparePassword(parsed.password);
    if (!matched) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: 'Login error', error: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  // For simplicity refresh simply issues a new token when valid token present
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid token user' });
    const newToken = signToken(user);
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ message: 'Token invalid', error: err.message });
  }
};
