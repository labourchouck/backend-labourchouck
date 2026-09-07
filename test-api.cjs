const axios = require('axios');
async function test() {
  try {
    const login = await axios.post('http://localhost:5002/api/v1/auth/admin/login', {
      email: 'admin@labourchowck.local',
      password: 'ChangeMe@123'
    });
    const token = login.data.data.token || login.data.token;
    const stats = await axios.get('http://localhost:5002/api/v1/admin/reports/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(JSON.stringify(stats.data, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
test();
