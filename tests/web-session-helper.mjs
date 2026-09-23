export async function loginWeb(base, token) {
  const response = await fetch(`${base}/session`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok)
    throw Object.assign(new Error("login_recusado"), {
      status: response.status,
    });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const body = await response.json();
  const headers = { Cookie: cookie, Origin: base, "X-HVB-View": body.view_id };
  const fetcher = (url, options = {}) =>
    fetch(url, { ...options, headers: { ...options.headers, ...headers } });
  return { cookie, body, headers, fetcher, response };
}
