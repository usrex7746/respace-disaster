// 在文件顶部加上这行引入
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// 开启跨域允许前端调用
app.use(cors({
    origin: 'https://respace-disaster.com' // 只允许你的域名访问后端
}));
// 允许解析 JSON 格式的请求数据
app.use(express.json());

// 临时存储验证码（真实生产环境中会用数据库）
const otpStore = {};

// --- 发送验证码接口 ---
app.post('/api/send-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // 生成 6 位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 记录验证码
    otpStore[email] = {
        code: code,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10分钟有效期
    };

    try {
        // 调用 Resend 发送全黑极简风格的邮件
        const { data, error } = await resend.emails.send({
            from: 'Respace Disaster <noreply@respace-disaster.com>', // 你的发件域名
            to: [email],
            subject: 'Access Code - Respace Disaster',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #000; color: #F9F8F4; padding: 50px 20px; text-align: center;">
                    <h2 style="letter-spacing: 0.2rem; font-weight: 200; margin-bottom: 30px;">RESPACEDISASTER</h2>
                    <p style="color: rgba(249, 248, 244, 0.6); font-size: 14px;">Your single-use access code is:</p>
                    <h1 style="font-size: 36px; letter-spacing: 0.5rem; margin: 20px 0; font-weight: 300;">${code}</h1>
                    <p style="color: rgba(249, 248, 244, 0.4); font-size: 12px; margin-top: 40px;">This code expires in 10 minutes.</p>
                </div>
            `
        });

        if (error) {
            console.error('发信错误:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        console.log(`验证码 ${code} 已发送至 ${email}`);
        res.status(200).json({ success: true, message: 'Code sent successfully' });

    } catch (err) {
        console.error('系统错误:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- 新增接口：处理 Google 登录 ---
app.post('/api/google-login', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }

    try {
        // 让 Google 的官方包去验证这个 token 是不是伪造的
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,  // 校验这是不是发给你的
        });
        
        const payload = ticket.getPayload();
        const userEmail = payload.email; // 成功拿到了用户的 Google 邮箱！

        // 【自动注册/登录逻辑】
        // 生产环境中，你应该在这里查询数据库：
        // let isNewUser = false;
        // if (!db.findUser(userEmail)) { 
        //     db.createUser(userEmail); 
        //     isNewUser = true; 
        // }

        console.log(`>>> 用户 ${userEmail} 通过 Google 登录成功！`);

        res.status(200).json({ 
            success: true, 
            message: 'Google login successful',
            email: userEmail,
            isNewUser: false // 模拟返回状态
        });

    } catch (error) {
        console.error('Google 验证失败:', error);
        res.status(401).json({ error: 'Invalid Google Token' });
    }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`>>> 后端服务器已启动：http://localhost:${PORT}`);
});