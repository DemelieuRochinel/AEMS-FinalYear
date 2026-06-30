const express     = require('express');
const jwt         = require('jsonwebtoken');
const router      = express.Router();
const userService = require('../services/userService');
const { authenticate } = require('../middleware/authentication');
const { randomUUID } = require('crypto');

// Helper — generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId:     user.id,
      email:      user.email,
      role:       user.role,
      businessId: user.business_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper — validate email format 
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error:   'Invalid Credentials',
        message: 'Email and password are required',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error:   'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    const user = await userService.authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({
        error:   'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const token = generateToken(user);

    console.log(`Login: ${user.email} (${user.role})`);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        businessId:  user.business_id,
        permissions: user.permissions,
        language:    user.language,
      },
    });

  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      error:   'Login failed',
      message: error.message,
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, business_id } = req.body;

    // Input validation
    const errors = [];
    if (!name)        errors.push('name is required');
    if (!email)       errors.push('email is required');
    if (!password)    errors.push('password is required');
    if (!business_id) errors.push('business_id is required');

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Missing fields', errors });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:   'Password too short',
        message: 'Password must be at least 8 characters',
      });
    }

    // Check if email already exists
    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error:   'Email already registered',
        message: 'An account with this email already exists',
      });
    }

    // Create user - ✅ FIXED: Use ROLES.OWNER
    const userId  = `user_${randomUUID()}`;
    const created = await userService.createUser(userId, {
      name,
      email,
      password,
      phone:       phone || null,
      role:        role  || userService.ROLES.OWNER,
      business_id,
    });

    const token = generateToken({ ...created.data, id: userId });

    console.log(`New user: ${email} (${role || 'BusinessOwner'})`);

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id:         userId,
        name,
        email,
        role:       role || userService.ROLES.OWNER,
        businessId: business_id,
      },
    });

  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({
      error:   'Registration failed',
      message: error.message,
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user });

  } catch (error) {
    return res.status(500).json({
      error:   'Failed to get profile',
      message: error.message,
    });
  }
});

module.exports = router;
