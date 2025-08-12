const jwt = require('jsonwebtoken');

module.exports = function registerAuthRoutes(app) {
    // ---------- Auth (cookie httpOnly)
    const COOKIE = 'session';
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

    const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',       // prod: true, local: false
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 2 * 60 * 60 * 1000,
    };

    app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === 'admin' && password === 'admin') {
        const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
        res.cookie(COOKIE, token, COOKIE_OPTS);
        return res.sendStatus(204);
    }
    return res.status(401).json({ error: 'bad_credentials' });
    });

    app.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
    res.sendStatus(204);
    });

    app.get('/healthz', (_req,res)=>res.status(200).send('ok'));

    app.get('/me', (req, res) => {
    try {
        const token = req.cookies?.[COOKIE];
        const payload = jwt.verify(token, JWT_SECRET);
        res.json({ user: payload.sub, role: payload.role });
    } catch {
        res.status(401).json({ error: 'unauthenticated' });
    }
    });
}

