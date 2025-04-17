export default async function handler(req, res) {
  const apiKey = '9c28d2905ccce4a47416a00db2a28d2930dc44564e48f5823b54c0809b8ce7b7';
  const { endpoint, ...params } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint parameter is required' });
  }

  try {
    // Remove endpoint from params as it's part of the URL
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== 'undefined') {
        queryString.append(key, value);
      }
    }

    const url = `https://api.leptonmaps.com/v1/${endpoint}${queryString.toString() ? '?' + queryString.toString() : ''}`;
    console.log('Requesting URL:', url);

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.status === 402) {
        return res.status(402).json({
          error: 'API subscription required',
          message: 'The API key requires a paid subscription or has exceeded its quota.',
          details: errorText
        });
      }
      
      return res.status(response.status).json({
        error: `API request failed with status ${response.status}`,
        message: response.statusText,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('API Success Response:', {
      url: url,
      params: params,
      response: data
    });

    // Validate toll data
    if (data && typeof data.total_toll_price === 'undefined') {
      console.error('Invalid toll data received:', data);
      return res.status(400).json({
        error: 'Invalid toll data',
        message: 'The API response did not contain expected toll information',
        details: data
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', {
      error: error.message,
      stack: error.stack,
      params: params
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 