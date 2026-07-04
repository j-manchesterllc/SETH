const https = require('https');

https.get('https://supabase.com', (res) => {
  console.log('Supabase.com status code:', res.statusCode);
}).on('error', (e) => {
  console.error('Error accessing supabase.com:', e.message);
});