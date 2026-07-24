const http = require('http');
fetch('http://localhost:8000/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'muhidbaloach01@gmail.com', password: 'anything'})
}).then(r => r.json()).then(data => {
    fetch('http://localhost:8000/admin/stats', {
        headers: {'Authorization': 'Bearer ' + data.access_token}
    }).then(r => r.json()).then(console.log);
});
