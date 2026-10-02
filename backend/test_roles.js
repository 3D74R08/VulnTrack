const loginAndTest = async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({correo: 'admin@acme.com', password: 'VulnTrackApp!123'})
  });
  const data = await res.json();
  console.log('Login:', data);

  if (data.token) {
      const rolesRes = await fetch('http://localhost:3000/api/roles', {
          headers: {'Authorization': 'Bearer ' + data.token}
      });
      const rolesData = await rolesRes.json();
      console.log('Roles status:', rolesRes.status);
      console.log('Roles Data:', rolesData);
  }
};
loginAndTest();
