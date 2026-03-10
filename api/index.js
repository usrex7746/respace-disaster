const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors({
    origin: ['https://respace-disaster.com', 'http://localhost:3000', 'http://127.0.0.1:5500']
}));
app.use(express.json());

// 临时数据库（部署到 Vercel 后建议连接持久化数据库）
let users = []; 

// --- 接口 1: 检查用户是否存在 ---
app.post('/api/check-user', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    res.json({ isNew: !user });
});

// --- 接口 2: 注册 ---
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User exists" });
    
    users.push({ email, password, method: 'email' });
    res.json({ success: true });
});

// --- 接口 3: 登录 ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ success: true });
});

// --- 接口 4: Google 登录 (原有逻辑) ---
app.post('/api/google-login', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: req.body.token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { email } = ticket.getPayload();
        let user = users.find(u => u.email === email);
        if (!user) users.push({ email, method: 'google' });
        res.json({ email, isNewUser: !user });
    } catch (err) { res.status(401).json({ error: "Google Auth Failed" }); }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`>>> Server running on http://localhost:${PORT}`));