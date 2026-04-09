export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  const contentType = req.headers["content-type"] || "";
  let data = {};

  if (contentType.includes("application/json")) {
    try {
      data = req.body || {};
    } catch {
      data = {};
    }
  } else {
    let body = "";
    if (typeof req.body === "string") {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body.toString("utf8");
    }
    const params = new URLSearchParams(body);
    data = Object.fromEntries(params.entries());
  }

  const honeypot = (data.company || "").toString().trim();
  if (honeypot) {
    return res.status(200).redirect(302, "/thanks.html");
  }

  const payload = {
    fullName: (data.full_name || "").trim(),
    phone: (data.phone || "").trim(),
    email: (data.email || "").trim(),
    city: (data.city || "").trim(),
    need: (data.need || "").trim()
  };

  const missing = ["fullName", "phone", "email", "city"].filter((key) => !payload[key]);
  if (missing.length) {
    return res.status(400).send("Missing required fields.");
  }

  const resendKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.LEAD_EMAIL_TO;
  const emailFrom = process.env.LEAD_EMAIL_FROM;

  if (!resendKey || !emailTo || !emailFrom) {
    return res.status(500).send("Email service not configured.");
  }

  const subject = `New EZ Gutters lead from ${payload.fullName}`;
  const html = `
    <h2>New Lead</h2>
    <p><strong>Name:</strong> ${payload.fullName}</p>
    <p><strong>Phone:</strong> ${payload.phone}</p>
    <p><strong>Email:</strong> ${payload.email}</p>
    <p><strong>City:</strong> ${payload.city}</p>
    <p><strong>Need:</strong> ${payload.need || "Not provided"}</p>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to: emailTo,
      subject,
      html
    })
  });

  if (!resp.ok) {
    return res.status(502).send("Failed to send email.");
  }

  return res.status(302).redirect("/thanks.html");
}
