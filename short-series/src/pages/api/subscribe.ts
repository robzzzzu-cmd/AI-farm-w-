import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const resend = new Resend(import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const audienceId = import.meta.env.RESEND_AUDIENCE_ID || process.env.RESEND_AUDIENCE_ID;

    // 1. Add contact to Resend Audience/List
    if (audienceId) {
      await resend.contacts.create({
        email,
        unsubscribed: false,
        audienceId,
      });
    }

    // 2. Optional: Send an immediate confirmation/welcome email
    await resend.emails.send({
      from: 'Trade Opportunities <newsletter@tradeopportunities.trade>', // Must be a verified domain in Resend
      to: email,
      subject: 'Welcome to Trade Opportunities Daily',
      html: `
        <h2>Welcome aboard!</h2>
        <p>You are now subscribed to daily market updates, technical breakdowns, and trading setups.</p>
        <p>Stay tuned for the next market open.</p>
      `,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Subscribed successfully!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
