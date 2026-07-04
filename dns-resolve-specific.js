const dns = require('dns');

// Try to get IPv4 address specifically
dns.resolve4('db.zaoroijuvdykeqayymnp.supabase.co', (err, addresses) => {
  if (err) {
    console.error('DNS resolve4 error:', err);
    return;
  }
  
  console.log('IPv4 addresses for db.zaoroijuvdykeqayymnp.supabase.co:');
  console.log(addresses);
  
  // Try to get IPv6 address specifically
  dns.resolve6('db.zaoroijuvdykeqayymnp.supabase.co', (err6, addresses6) => {
    if (err6) {
      console.error('DNS resolve6 error:', err6);
      return;
    }
    
    console.log('IPv6 addresses for db.zaoroijuvdykeqayymnp.supabase.co:');
    console.log(addresses6);
  });
});