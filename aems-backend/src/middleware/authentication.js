//  Verifies JWT token on every protected API route
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No access token provided. Include Authorization: Bearer <token>',
            });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            businessId: decoded.businessId
        };
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please log in again',
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid Token',
                message: 'Token is malformed or tampered.',
            });
        }
        return res.status(500).json({
            error: 'Authentication Error',
            message: error.message,
        });
    }
};

// ── UPDATED: Role-based access control with role mapping ──
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not authenticated'
            });
        }
        
        const userRole = req.user.role;
        
        // ── ROLE MAPPING: Map BusinessOwner → owner ──
        const roleMap = {
            'BusinessOwner': 'owner',
            'owner': 'owner',
            'Staff': 'staff',
            'staff': 'staff',
            'Technician': 'technician',
            'technician': 'technician',
        };
        
        // Get the normalized role for the user
        const normalizedUserRole = roleMap[userRole] || userRole.toLowerCase();
        
        // Normalize allowed roles
        const normalizedAllowedRoles = allowedRoles.map(r => {
            // If the allowed role is 'owner', also allow 'BusinessOwner'
            if (r.toLowerCase() === 'owner') {
                return ['owner', 'businessowner'];
            }
            return [r.toLowerCase()];
        }).flat();
        
        // Check if user's role matches any allowed role
        const hasAccess = normalizedAllowedRoles.some(role => 
            normalizedUserRole === role || 
            normalizedUserRole === role.toLowerCase()
        );
        
        if (!hasAccess) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
                yourRole: req.user.role,
                requiredRoles: allowedRoles,
            });
        }
        
        next();
    };
};

module.exports = { authenticate, requireRole };