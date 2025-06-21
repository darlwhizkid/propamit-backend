export default function handler(req, res) {
  console.log("TEST ENDPOINT CALLED");
  res.json({ success: true, message: "Test endpoint works", method: req.method, body: req.body });
}
