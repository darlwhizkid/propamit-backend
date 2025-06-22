// CORS helper for Vercel serverless functions
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://propamit.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function handleCors(req, res) {
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // Indicates preflight was handled
  }
  
  return false; // Continue with normal request
}
