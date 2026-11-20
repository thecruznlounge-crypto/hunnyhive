/* Mobile EV charging services — they drive to a stranded EV and add enough charge to reach a charger.
   Everything is shown inside Roadesy (nothing opens outside the app).
   Checked Nov 2026 from each company's own site; re-check periodically.
   areas: center + radius (km) of each service area, used to show only companies that cover the user's spot. */
window.MOBILE_EV = [
  {
    name: "Rapid Charge EV",
    phone: "954-278-4454",
    hours: "24/7",
    note: "Mobile EV charging · Miami-Dade, Broward, Palm Beach & Jacksonville",
    services: ["Emergency mobile EV charging", "Comes to homes, garages, airports & highways"],
    coverage: "Broward, Miami-Dade and Palm Beach counties, plus the Jacksonville metro. In Miami: Downtown, Brickell, Wynwood, Edgewater, Coconut Grove, Little Havana, Port of Miami, MIA, and the I-95, I-195 and MacArthur Causeway corridors.",
    request: ["Give your exact location — address and garage level, airport terminal, or highway mile marker / intersection",
              "Your EV make and model and current battery %",
              "Access notes (valet, gate code, garage clearance)",
              "They confirm your connector type and an arrival time"],
    site: "myrapidchargeev.com",
    areas: [{lat: 26.20, lon: -80.20, km: 95}, {lat: 30.33, lon: -81.66, km: 50}]
  },
  {
    name: "Bee Charged EV",
    phone: "888-675-9555",
    note: "Mobile EV charging · Miami-Dade & Broward, incl. I-95 and the Turnpike",
    services: ["Emergency roadside EV charging", "Membership plans", "Fleet charging"],
    coverage: "Miami-Dade (Miami Beach, Downtown, Brickell, Coral Gables, Doral, Kendall, Aventura) and Broward (Fort Lauderdale, Hollywood, Pembroke Pines, Miramar, Plantation, Sunrise), including I-95 and Florida's Turnpike.",
    price: "Service calls typically $79–$129 (per the company). Ask whether a one-time charge is available without a membership.",
    request: ["Call and give your location", "Your EV make and model and battery %"],
    site: "beechargedev.com",
    areas: [{lat: 25.95, lon: -80.25, km: 60}]
  },
  {
    name: "Take Charge Mobile",
    phone: "833-442-4274",
    hours: "7am–10pm; after-hours service 10pm–7am",
    note: "Emergency EV charge + 12V jump & lockout · I-35 corridor, Texas",
    services: ["Emergency EV charge — up to 10 kWh or 1 hour, enough to reach a fast charger", "12V battery jump", "Lockout service"],
    coverage: "Dallas–Fort Worth, Frisco, Plano, Waco, Georgetown, Round Rock, Austin, Lakeway, Bastrop, San Marcos, New Braunfels, San Antonio and Schertz.",
    price: "Flat $159.99 (7am–10pm) or $199.99 after hours. Platinum membership $199.99/yr includes 2 charges. Paid in advance; parking and tolls extra.",
    request: ["Call and give your location", "Your EV make and model and battery %", "Pay when booking"],
    site: "tcmcharge.com",
    areas: [{lat: 32.80, lon: -97.00, km: 70}, {lat: 31.55, lon: -97.15, km: 40}, {lat: 30.30, lon: -97.75, km: 60}, {lat: 29.55, lon: -98.30, km: 55}]
  },
  {
    name: "Atlanta Mobile EV Charging",
    phone: "",
    note: "Mobile EV charging · metro Atlanta",
    services: ["Emergency mobile EV charging on highways, in garages, apartments and shopping centers"],
    coverage: "Metro Atlanta.",
    request: ["Books through the company's website (no public phone number listed)"],
    site: "atlantamobileevcharging.com",
    areas: [{lat: 33.75, lon: -84.39, km: 60}]
  },
  {
    name: "AAA",
    phone: "1-800-222-4357",
    note: "Members · some AAA clubs offer mobile EV charging, others tow to the nearest charger",
    services: ["Roadside assistance for members", "Mobile EV charging in some club areas", "Tow to the nearest charger"],
    coverage: "Nationwide (mobile EV charging only where your local AAA club offers it).",
    request: ["Have your membership number ready", "Say you're in an EV that's out of charge"],
    national: true
  }
];
