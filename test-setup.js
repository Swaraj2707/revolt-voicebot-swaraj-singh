const http = require('http');

// Test backend server connection
const testBackend = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Backend server is running on port 3001`);
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log(`Response: ${JSON.stringify(response, null, 2)}`);
      } catch (e) {
        console.log(`Raw response: ${data}`);
      }
    });
  });

  req.on('error', (err) => {
    console.log(`❌ Backend server is not running on port 3001`);
    console.log(`Error: ${err.message}`);
    console.log(`\nTo start the backend server, run:`);
    console.log(`cd server && npm run dev`);
  });

  req.end();
};

// Test frontend availability
const testFrontend = () => {
  const options = {
    hostname: 'localhost',
    port: 5173,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Frontend is running on port 5173`);
    console.log(`Status: ${res.statusCode}`);
  });

  req.on('error', (err) => {
    console.log(`❌ Frontend is not running on port 5173`);
    console.log(`Error: ${err.message}`);
    console.log(`\nTo start the frontend, run:`);
    console.log(`npm run dev`);
  });

  req.end();
};

console.log('🧪 Testing Revolt Motors Voice Chatbot Setup...\n');

setTimeout(testBackend, 1000);
setTimeout(testFrontend, 2000);

console.log('Testing in progress...\n');
