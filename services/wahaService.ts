
/**
 * Service to handle WhatsApp notifications via WAHA
 * The WAHA instance URL is configured via environment variables
 */
export const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    // Get URL from environment or fallback to localhost
    const wahaUrl = import.meta.env.VITE_WAHA_API_URL || 'http://localhost:3000';

    // Ensure the URL doesn't end with a slash if we're appending /api/sendText
    const baseUrl = wahaUrl.endsWith('/') ? wahaUrl.slice(0, -1) : wahaUrl;

    console.log(`Sending WhatsApp using WAHA at: ${baseUrl}`);

    const response = await fetch(`${baseUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId: `${phone}@c.us`,
        text: message,
        session: 'default' // Default session in WAHA
      }),
    });

    if (!response.ok) {
      console.warn('WAHA Notification failed (instance might be offline).', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
};
