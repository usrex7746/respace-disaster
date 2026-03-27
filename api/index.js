const { OAuth2Client } = require('google-auth-library');
const { Resend } = require('resend'); 
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const resend = new Resend(process.env.RESEND_API_KEY); 

app.use(cors({
    origin: [
        'https://respace-disaster.com', 
        'https://www.respace-disaster.com',
        'http://localhost:3000', 
        'http://127.0.0.1:5500',
        /\.vercel\.app$/ 
    ]
}));
app.use(express.json());

// 临时数据库
let users = []; 
const verificationCodes = new Map(); 

// --- 接口 1: 检查用户是否存在 ---
app.post('/api/check-user', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    res.json({ isNew: !user });
});

// --- 接口 5: 发送验证码 (已加入增强错误捕获) ---
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: "User already exists" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    verificationCodes.set(email, {
        code: code,
        expiresAt: Date.now() + 5 * 60 * 1000 
    });

    try {
        // 修改点：解构出 error 对象以获取详细原因
        const { data, error } = await resend.emails.send({
            from: 'noreply@respace-disaster.com', 
            to: email,
            subject: '您的注册验证码 - Respace Disaster',
            html: `<p>您的验证码是：<strong>${code}</strong>。该验证码在 5 分钟内有效，请勿泄露给他人。</p>`
        });

        // 如果 Resend 返回了错误（例如 Key 错误、发件人未验证等）
        if (error) {
            console.error("Resend API Error Details:", error);
            return res.status(400).json({ error: `Mail service error: ${error.message}` });
        }

        console.log("Mail sent successfully:", data.id);
        res.json({ success: true, message: "Verification code sent" });

    } catch (err) {
        // 捕获网络异常或代码崩溃
        console.error("Server Side Fatal Error:", err);
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// --- 接口 2: 注册 ---
app.post('/api/register', (req, res) => {
    const { email, password, code } = req.body; 

    const record = verificationCodes.get(email);
    if (!record) return res.status(400).json({ error: "Please request a verification code first" });
    if (record.code !== code) return res.status(400).json({ error: "Invalid verification code" });
    
    if (Date.now() > record.expiresAt) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: "Verification code expired" });
    }

    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User exists" });
    
    users.push({ email, password, method: 'email' });
    verificationCodes.delete(email); 
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

// --- 接口 4: Google 登录 ---
app.post('/api/google-login', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: req.body.token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const { email } = ticket.getPayload();
        let user = users.find(u => u.email === email);
        let isNew = false;
        if (!user) {
            users.push({ email, method: 'google' });
            isNew = true;
        }
        res.json({ email, isNewUser: isNew });
    } catch (err) { res.status(401).json({ error: "Google Auth Failed" }); }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`>>> Local Server running on http://localhost:${PORT}`);
    });
}