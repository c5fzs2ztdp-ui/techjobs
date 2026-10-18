import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import type { User } from '../config/passport';

const router = Router();

// Where a browser lands when Google sign-in fails (denied consent, Google
// error): back at the app, where the frontend turns the authError param
// into a toast - never a bare JSON error page. Trailing slashes on
// FRONTEND_URL are stripped so the param URL stays clean.
export const authFailureRedirect = (): string =>
  `${(process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/+$/, '')}/?authError=1`;

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      google_id: string;
      email: string;
      name: string;
      picture: string;
      created_date: string;
      updated_date: string;
    }
  }
}

// Get current user
router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    });
  } else {
    res.json({ authenticated: false, user: null });
  }
});

// Initiate Google OAuth
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  // Store the redirect URL in session
  const redirectUrl = req.query.redirect as string || process.env.FRONTEND_URL || 'http://localhost:8080';
  (req.session as any).returnTo = redirectUrl;
  
  // Save session before redirecting to Google
  req.session.save((err) => {
    if (err) {
      console.error('Error saving session:', err);
    }
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res, next);
  });
});

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: authFailureRedirect()
  }),
  (req: Request, res: Response) => {
    // Redirect to frontend after successful login
    const returnTo = (req.session as any).returnTo || process.env.FRONTEND_URL || 'http://localhost:8080';
    delete (req.session as any).returnTo;
    res.redirect(returnTo);
  }
);

// Auth failure
router.get('/failure', (req: Request, res: Response) => {
  res.status(401).json({ error: 'Authentication failed' });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// Middleware to require authentication
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

// Middleware to optionally get user (doesn't require auth)
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // User will be available if authenticated, undefined otherwise
  next();
};

export default router;
