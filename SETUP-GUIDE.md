# Wellflow — Setup guide
## Getting your app live in about 30 minutes, no coding needed

---

## What you need before you start
- A free GitHub account — github.com
- A free Vercel account — vercel.com
- Your Anthropic API key — console.anthropic.com
- Your Stripe account (you already have this)

---

## Step 1 — Put the files on GitHub (5 minutes)

GitHub is where your code lives. Think of it as a folder in the cloud.

1. Go to github.com and log in
2. Click the green "New" button to create a new repository
3. Name it "wellflow", leave everything else as default, click "Create repository"
4. Click "uploading an existing file" on the next screen
5. Drag the entire "wellflow-app" folder into the upload area
6. Click "Commit changes" at the bottom

Your files are now on GitHub.

---

## Step 2 — Deploy to Vercel (5 minutes)

Vercel takes your GitHub files and puts them on the internet.

1. Go to vercel.com and log in with your GitHub account
2. Click "Add New Project"
3. Find your "wellflow" repository and click "Import"
4. Leave all settings as they are — just click "Deploy"
5. Wait about 60 seconds — Vercel will give you a live URL like wellflow.vercel.app

Your app is live but not working yet — you need to add your secret keys first.

---

## Step 3 — Add your secret keys to Vercel (10 minutes)

In Vercel, go to your project, click "Settings", then "Environment Variables". Add each of these:

### ANTHROPIC_API_KEY
- Your Anthropic API key from console.anthropic.com
- Starts with sk-ant-

### JWT_SECRET
- Make up any long random string of letters and numbers
- Example: wellflow2026xK9mP3qR7nL2vB8 (don't use this exact one)
- This is used to keep your users logged in securely

### STRIPE_SECRET_KEY
- In your Stripe dashboard, go to Developers > API Keys
- Copy the "Secret key" (starts with sk_live_ or sk_test_ for testing)

### STRIPE_PRICE_ID
- In Stripe, go to Products > Create a product
- Name it "Wellflow subscription", set price to €15, recurring monthly
- After saving, copy the Price ID (starts with price_)

### STRIPE_WEBHOOK_SECRET
- In Stripe, go to Developers > Webhooks > Add endpoint
- Endpoint URL: https://your-vercel-url.vercel.app/api/stripe/webhook
- Select events: checkout.session.completed and customer.subscription.deleted
- After saving, copy the "Signing secret" (starts with whsec_)

### BASE_URL
- Your Vercel URL, e.g. https://wellflow.vercel.app

After adding all environment variables, go back to your project in Vercel and click "Redeploy".

---

## Step 4 — Connect your own domain (optional, 10 minutes)

1. Buy a domain at namecheap.com — something like getwellflow.com or wellflow.io (about €12/year)
2. In Vercel, go to your project Settings > Domains
3. Add your domain and follow the simple DNS instructions Vercel gives you
4. Takes up to 10 minutes to go live

---

## Step 5 — Test everything

1. Go to your live URL
2. Sign up with your own email
3. Try generating some captions (you get 10 free)
4. Test the subscribe button — use Stripe's test card number 4242 4242 4242 4242 with any future date and any CVC
5. Check that after subscribing, the usage limit disappears

---

## You're live. What now?

- Share the URL in your Instagram bio
- Film a 30 second reel showing the tool in action
- Give 5 wellness teachers free access in exchange for honest feedback

---

## Need help?

If you get stuck at any point, screenshot the error and share it — I can help you fix it.
