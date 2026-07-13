# Backlog — SME Business Intelligence & Inventory Platform

Backlog is a lightweight, mobile-responsive, offline-first business intelligence and inventory management platform designed specifically for the dynamics of the Nigerian retail, wholesale, and agricultural market landscape.

---

## 🚀 The 3-Minute Investor Pitch

### **[0:00 - 0:45] The Hook & The Problem**
> *"In Nigeria, retail commerce is massive but flying blind. We have over 40 million micro, small, and medium enterprises. Think about the supermarket down your street in Uyo, the poultry farmer in Akwa Ibom, or the trader in Ariaria Market. How do they track sales? They use paper notebooks, mental calculations, or they don't track at all.*
>
> *This creates three fatal bottlenecks:*
> 1. ***Stock Outs:** They run out of fast-moving goods without realizing it, losing immediate revenue.*
> 2. ***The Bank Transfer Nightmare:** Bank transfers are now Nigeria's primary payment method. But matching incoming transfer alerts (without transaction descriptions) to physical items sold is a manual, chaotic guessing game.*
> 3. ***Data Invisibility:** They have no idea what their actual profit margins are, what stock is dead, or where demand is moving.*
>
> *Existing software like SAP or QuickBooks are built for Western markets—they are expensive, overly complex, require constant internet access, and do not understand the local informal market."*

### **[0:45 - 1:45] The Solution (Introducing Backlog)**
> *"That is why we built **Backlog**. Backlog is an offline-ready, mobile-first business intelligence tool that simplifies inventory, automates record-keeping, and bridges the gap between formal and informal trade.*
>
> *Here is how it solves the bottlenecks:*
> - ***One-Tap Sales & Inventory:** When a sale is made, the stock count reduces instantly. If an item runs low, Backlog alerts the owner.*
> - ***Automated Bank Sync & Reconciliation Center:** Backlog pulls incoming transfer alerts from linked bank APIs. The owner simply selects the items sold, and the platform matches the product prices against the incoming transfer value. One click, and it is reconciled—no more guessing who paid for what.*
> - ***AI Business Advisor:** The app acts as an active assistant. It flags dead stock, calculates exact profit margins, and provides daily recommendations like: 'You are running out of Milk,' or 'Mondays are slow, offer a promo.'*
> - ***1-Click Office Exports:** Business owners want reports they can trust. Backlog exports native, formatted Microsoft Excel sheets and Microsoft Word summaries in one click—perfect for loans, tax audits, or accounting."*

### **[1:45 - 2:30] Market Potential & Monetization**
> *"Our market is the 40 million Nigerian MSMEs across three distinct tiers:*
> 1. ***Micro (Hawkers, Students):** Free tier to drive viral adoption.*
> 2. ***Retailers (Market traders, Chemists, Poultry):** Standard tier at ₦2,500/month for advanced reporting and bank integration.*
> 3. ***Enterprise (Supermarkets, Wholesalers):** Pro tier at ₦15,000/month for multi-device sync, employee permissions, and custom receipts.*
>
> *Beyond subscriptions, our long-term moat is **data intelligence**. By aggregating anonymized transaction logs, we build a **National Demand Heatmap**. FMCG companies and manufacturers will pay premium fees to access real-time demand trends across Nigerian states."*

### **[2:30 - 3:00] The Close**
> *"Backlog is not just an accounting app. It is community infrastructure for Nigerian commerce. We are bringing structure, visibility, and growth to the businesses that power our nation. Thank you."*

---

## 🛠️ The Nigerian Market Context

### 1. The Informal Domination
Over 80% of Nigeria's labor force is in the informal sector. A high-tech system that requires complex inputs, logins, and enterprise configurations will fail. Backlog uses an **icon-first grid layout** and **Pidgin/Local English optimization** to make record-keeping accessible to street-level vendors.

### 2. The Bank Transfer Infrastructure
The cashless policy and cash scarcity cycles forced a structural shift to direct bank transfers. However, bank transaction alerts only contain the sender's name and amount (e.g. *₦8,000 from Chinedu Eze*). Backlog's **Bank Sync Reconciliation Center** is built specifically to address this pain point, allowing owners to match transactions without needing client descriptions.

### 3. Energy and Internet Deficits
Constant internet is a luxury in rural and suburban LGAs. Backlog is built on an **offline-first architecture** using LocalStorage. It functions 100% offline and automatically syncs logs to the cloud when a network connection is detected.

---

## 🔧 How to Deploy and Make it Live (Free & Fast)

Since Backlog is currently built as a static frontend application (HTML, CSS, JS), you can host it live in **less than 5 minutes for free**:

### Option 1: Vercel (Recommended)
1. Install the Vercel CLI: `npm install -g vercel` (if you have Node.js installed).
2. Open terminal in the `backlog` directory.
3. Run: `vercel`
4. Follow the prompts. It will give you a live URL (e.g. `backlog-sme.vercel.app`) in seconds.

### Option 2: Netlify (Drag and Drop — Easiest)
1. Go to [netlify.com](https://www.netlify.com/).
2. Log in or create a free account.
3. Go to the "Sites" tab and locate the **"Drag and drop your site folder here"** area.
4. Drag the entire `backlog` folder and drop it.
5. Netlify will deploy it instantly and provide a shareable link.

### Option 3: GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to the repository **Settings** → **Pages**.
3. Under "Build and deployment", select **main** branch and `/` (root folder) or `/docs`.
4. Click Save. Your site will be live at `yourusername.github.io/repositoryname`.

---

## 📹 Social Media Video Script (60-Seconds Reel/TikTok)

**Visual Flow:**
* **[0:00 - 0:10] Video starts with you holding a dusty paper ledger or notebook.**
  * *Speaker:* "If you’re running a business in Nigeria, throw this away. Seriously." (Drop the book on the table).
* **[0:10 - 0:25] Transition to a screen recording of the Backlog App on a phone/laptop.**
  * *Speaker:* "This is Backlog. The smartest way to run a business in Nigeria. Every time you make a sale, your stock updates automatically. No calculators, no errors."
* **[0:25 - 0:45] Show the Bank Sync view on screen.**
  * *Speaker:* "And if you’re tired of matching bank transfers to who actually bought what, look at this. The Bank Sync imports the transfer alert, you select the items, it matches the price, and updates your inventory in one tap."
* **[0:45 - 0:60] Show the Excel download action and the AI Insights screen.**
  * *Speaker:* "You get AI recommendations telling you what stock is running low, and you can download a full Excel or Word report for your bank in one click. Link is in my bio—try the free demo today!"

---

## ⚡ Technical Features list

* **LocalStorage database engine:** Keeps records local, saving data costs.
* **Native Excel (.xlsx) generator:** Employs the `SheetJS` library.
* **Native Word (.doc) generator:** Creates formatted text documents without server dependencies.
* **Responsive Layout:** Adaptive styling optimized for cheap Android mobile devices and desktop cash registers.
* **Dynamic Demand Heatmaps:** Evaluates high-performing states using custom visual indicator meters.
