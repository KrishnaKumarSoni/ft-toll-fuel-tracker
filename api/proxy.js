export default async function handler(req, res) {
  const apiKey = '9c28d2905ccce4a47416a00db2a28d2930dc44564e48f5823b54c0809b8ce7b7';
  const { query } = req;
  
  try {
    const response = await fetch(`https://api.leptonmaps.com/v1/${query.endpoint}?${new URLSearchParams(query).toString()}`, {
      headers: {
        'x-api-key': apiKey
      }
    });
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 