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
    console.log('Proxy: Making request to:', url);

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Proxy: API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return res.status(response.status).json({
        error: `API request failed with status ${response.status}`,
        message: response.statusText,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('Proxy: Successful response:', {
      toll_count: data.toll_count,
      total_toll_price: data.total_toll_price,
      has_route: !!data.route,
      has_toll_booths: !!data.toll_booths
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy: Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 