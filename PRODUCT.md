# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Car sales advisors (sales consultants) at Malaysian dealerships, selling Proton, Proton e.MAS, Chery, Omoda | Jaecoo, Honda and GWM. Confirmed by the owner (2026-11-17): they mostly use Redline **on a phone, in the showroom**, standing with a customer in bright showroom or outdoor light. Many are not young and not technical; the owner's words: "easy to use (even for the old folks)". A new advisor must be able to produce a first quote without being taught.

Second audience: the advisor's **customers**, who open a public quote link (no account, no login) on their own phone to pick a car, change deposit and loan period, compare cars, open brochures and send their quote to the advisor on WhatsApp.

## Product Purpose

Turn a car price into a full loan quotation in seconds, then get it in front of a customer: as a poster image, as a live quote link, or on screen during a TikTok Live. Success is an advisor answering "how much a month?" correctly and sending the answer before the customer loses interest.

## Positioning

A quoting tool, not a CRM: it never asks for or stores the customer's name, phone or IC number. It ships loaded with current Malaysian prices, variants and official brochures, and every quote follows the advisor's own prices, rebates, interest rate and loan rounding.

## Operating Context

- Quoting happens face to face or over WhatsApp; the answer is usually shared as an image or a link, and WhatsApp is the main channel.
- Customers usually know their monthly budget, not their car (hence Budget).
- Live Mode is captured on TikTok Live: a "Live Screen" on camera while the advisor changes the car and deposit off camera; it also opens in its own window or full screen on a tablet.
- The app is installable (PWA) and works on phone, tablet and PC.
- Languages: English and Bahasa Melayu across the app, posters, Live Mode and WhatsApp messages.

## Capabilities and Constraints

Signed-in screens: Calculator (home; poster layouts Full Quotation, Monthly Estimate, Compact, Rebate Deal; customise car, price, rebate, insurance, interest, loan period), Compare (up to 3 cars), Budget (cars that fit a monthly instalment and cash on hand), Live Mode, Quote Links (all-brands and primary-brand link, QR, WhatsApp share, anonymous link activity), Catalog (brochures and offers), Price Settings (OTR prices, rebates, insurance tariff, price list import), My Profile, Settings (appearance, language, brands, account, export, delete).

Public screens: landing (`/welcome`), log in, sign up, forgot and reset password, Privacy, Terms, and the customer quote link (`/quote/:token`).

Constraints:
- Angular 19 standalone components with inline templates, Tailwind CSS 4, a Cloudflare Worker + D1 backend. The site's CSP blocks inline scripts.
- Posters, the Live Screen and brochure images are rendered output (canvas / fixed designs) with their own design; they are the product's deliverable, not app chrome.
- Light and dark themes both exist and follow the device unless set in Settings.
- The live site is in testing mode with no real users yet.
- No feature may be removed without asking the owner.

## Brand Commitments

- The name **Redline** stays (confirmed 2026-11-17). The colour scheme is open: red is not required and today's dark charcoal look is not binding.
- The result must not feel **flashy or playful** (a game or gimmick a dealer would not trust), and must not feel **crowded** (too much on screen, small text, hard to find the main button). Owner's words for the target: "look interesting while also being professional".
- Never use a real person's name, phone or email as placeholder, default, example or test data.
- Shared posters and files carry the file and title only; no automatic "name, role" text is added to a share.

## Evidence on Hand

- Real product screenshots used on the landing page: `public/landing/*.webp`.
- Car images `public/cars/*.png`, brand logos `public/brands/*.svg`, official brochures `public/brochures/*.pdf`.
- 75 variants across six brands loaded in the catalog data.
- No testimonials, customer counts, awards or pricing exist; none may be invented.

## Product Principles

1. The monthly figure is the answer. Every screen makes it the easiest thing to read and the easiest thing to send.
2. One obvious next step per screen; setup and advanced options stay out of the way until asked for.
3. Readable at arm's length in bright light: large type, strong contrast, big touch targets, plain words.
4. A newcomer is shown what to do first, and can always ask to be shown again.
5. Calm and trustworthy over clever: nothing a dealer would be embarrassed to show a customer.

## Accessibility & Inclusion

Older, non-technical users on phones are a primary audience (owner requirement): large readable text, strong contrast, large tap targets, plain wording, few steps per task, obvious primary actions, and nothing that depends on hover or on a small icon alone. Target WCAG 2.1 AA contrast as the floor.
