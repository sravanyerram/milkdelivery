===============================================================================
🥛 SMART MILK DELIVERY APP - PROJECT README
===============================================================================

PROJECT OVERVIEW
----------------
An end-to-end management system for local vendors to track daily deliveries,
manage vacation schedules, and automate invoicing workflows. 
Developed using a high-velocity, agentic AI architecture.

TECHNICAL STACK
---------------
* Frontend : Next.js 16 (App Router) & React 19
* Styling  : Tailwind CSS v4
* Backend  : Firebase (Auth & Firestore) for real-time sync
* AI Flow  : Google Antigravity & Claude Models

QUALITY ASSURANCE & TESTING (LEAD-LEVEL STRATEGY)
-------------------------------------------------
Designed with 15+ years of QA leadership experience.

* Framework   : Playwright E2E Automation
* Environment : Firebase Emulators (Auth/Firestore)
* AI Debugging: Leveraged agents to resolve Firestore race conditions

FUNCTIONAL VERIFICATION (ARTIFACTS)
-----------------------------------
Full video proof of functionality is stored in ./documentation/demos/

[ PASS ] Admin Approval & Delivery Run -> ./documentation/demos/Admin Dashboard.webm
[ PASS ] Client Dashboard & Logging    -> ./documentation/demos/Client Dashboard.webm

LOCAL SETUP & EXECUTION
-----------------------
1. Install Dependencies: npm install
2. Start Dev Server   : npm run dev
3. Start Emulators    : firebase emulators:start --project=demo-milk
4. Run E2E Suite      : npx playwright test

-------------------------------------------------------------------------------
END OF DOCUMENTATION