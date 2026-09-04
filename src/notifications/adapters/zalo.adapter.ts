export async function sendZalo(accessToken: string, userId: string, text: string): Promise<void> {
  const res = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': accessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zalo error: ${err}`);
  }
}
