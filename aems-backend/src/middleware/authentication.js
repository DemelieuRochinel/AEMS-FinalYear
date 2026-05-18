
//  Verifies JWT token on every protected API route

//  Usage in routes:
//  router.get('/protected', authenticate, (req, res) => {})

//  How it works:
//  1. Client sends request with header: Authorization: Bearer <token>
//  2. This middleware extracts the token
//  3. Verifies it was signed with our JWT_SECRET
//  4. Attaches decoded user data to req.user
//  5. Calls next() to proceed to the actual route handler
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    try {

        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith('Bearer ')){

            return res.status(401).json({
                error: 'Unauthorized',

                message: 'No access toke provided. Include Authorization: Bearer <token>',
            });
        }
        const token = authHeader.split(' ')[1];

        // Verify token signature and expiry
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        //  Attach user data to request for use in route handler
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            businessId: decoded.businessId
        };
        next();

    } catch(error) {
        if(error.name ===  'TokenExpiredError'){
            return res.status(401).json({
                error: 'Token expired',
                nessages: 'Your session has expired. please log in again',
            });
        }
        if(error.name === 'JsonWebTokenError'){
            return res.status(401).join({
                error: 'Invalid Token',
                message: 'Token is malformed or tamperd.',
            });
        }
        return res.status(500).join({
            error: 'Authentication Error',
            message: error.message,
        });
    }
};

// Role-based access control
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if(!req.user){
            return res.status(401).join({
                error: 'Not authenticated'
            });
        }
        if(!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires on of these role: ${allowedRoles.join(', ')}`,
                yourRole: req.user.role,
            });
        }
            next();
    };
};

module.exports = {authenticate, requireRole};
