const axios = require('axios');
const { JSDOM } = require('jsdom');

// 用户配置
const USERNAME = process.env.FREECLOUD_USERNAME;
const PASSWORD = process.env.FREECLOUD_PASSWORD;
const PORT = process.env.FREECLOUD_PORT;

const BASE_URL = 'https://freecloud.ltd';
const LOGIN_URL = `${BASE_URL}/login`;
const RENEW_URL = `${BASE_URL}/server/detail/${PORT}/renew`;

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Content-Type': 'application/json'
};

(async () => {
  try {
    // 获取登录页面，解析 math captcha
    const loginPage = await axios.get(LOGIN_URL, { headers });
    const dom = new JSDOM(loginPage.data);
    const document = dom.window.document;

    // 提取验证码表达式，如 "3 + 5"
    const captchaText = document.querySelector('label[for=math_captcha]')?.textContent || '';
    const match = captchaText.match(/(\d+)\s*([+-])\s*(\d+)/);
    if (!match) throw new Error('无法识别验证码');

    const [, n1, op, n2] = match;
    const captchaAnswer = op === '+' ? (+n1 + +n2) : (+n1 - +n2);

    // 登录提交
    const loginResp = await axios.post(LOGIN_URL, {
      username: USERNAME,
      password: PASSWORD,
      math_captcha: captchaAnswer
    }, {
      headers,
      withCredentials: true // 保持 Cookie
    });

    if (loginResp.status !== 200 || loginResp.data?.success === false) {
      throw new Error(`登录失败: ${loginResp.data?.message || loginResp.statusText}`);
    }

    // 提取 cookies
    const cookie = loginResp.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
    if (!cookie) throw new Error('未获取到登录 Cookie');

    // 发送续期请求
    const renewResp = await axios.post(RENEW_URL, {}, {
      headers: {
        ...headers,
        Cookie: cookie
      }
    });

    if (renewResp.status === 200 && renewResp.data?.success !== false) {
      console.log('✅ 续期成功:', renewResp.data?.message || '');
    } else {
      console.error('❌ 续期失败:', renewResp.data?.message || renewResp.statusText);
      process.exit(1);
    }

  } catch (err) {
    console.error('🚨 错误:', err.message);
    process.exit(1);
  }
})();
