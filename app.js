(function () {
  "use strict";

  /* ---------- reference data ---------- */
  var CATS = {
    farm: "Farming & fisheries", health: "Health", home: "Housing & energy", food: "Food & fuel",
    money: "Banking, insurance & pensions", work: "Jobs, skills & business", family: "Family, seniors & disability", edu: "Education", state: "State schemes"
  };
  var STATES = { KA: "Karnataka", MH: "Maharashtra", TN: "Tamil Nadu", UP: "Uttar Pradesh" };
  var OCC = [
    ["farmer", "Farmer (own land)"], ["tenant", "Tenant farmer / sharecropper"], ["labour", "Daily-wage or farm labourer"],
    ["fisher", "Fisher, dairy or livestock"], ["vendor", "Street vendor"], ["artisan", "Artisan / craftsperson"],
    ["business", "Small business / self-employed"], ["salaried", "Private job"], ["govt", "Government employee"],
    ["student", "Student"], ["unemployed", "Looking for work"], ["homemaker", "Homemaker"], ["retired", "Retired"]
  ];
  var FLAGS = [
    ["bpl", "Family has a BPL, AAY or priority ration card"],
    ["pucca", "Family owns a pucca (concrete) house"],
    ["noBank", "I do not have a bank account"],
    ["noLpg", "No LPG gas connection at home"],
    ["taxpayer", "I or my household pay income tax"],
    ["orgMember", "Member of EPFO, ESIC or NPS"],
    ["widow", "Widow"],
    ["pregnant", "Pregnant or breastfeeding"],
    ["girl", "Girl child under 10 in the family"]
  ];
  var D = {
    aad: "Aadhaar card", bank: "Bank passbook (Aadhaar-linked)", mob: "Mobile number linked to Aadhaar", photo: "Passport-size photos",
    income: "Income certificate", caste: "Caste certificate", land: "Land ownership record", addr: "Address proof", ration: "Ration card",
    age: "Age proof", udid: "Disability certificate / UDID card", marks: "Last exam marksheet", fee: "Admission and fee receipt",
    bus: "Business or trade proof", pan: "PAN card", mcp: "Pregnancy (MCP) card", birth: "Girl child's birth certificate",
    death: "Husband's death certificate", vend: "Vending certificate or local body letter", bill: "Electricity bill",
    tenancy: "Tenancy or sharecropping record", edu: "Education certificates", minority: "Minority community declaration", domicile: "Domicile or residence certificate"
  };

  /* ---------- rule helpers: each returns true, false, null (needs an answer) or "maybe" (depends on official records) ---------- */
  function R(label, fn, need) { return { l: label, f: fn, need: need }; }
  function ageR(lo, hi) { return function (p) { return p.age == null ? null : (p.age >= lo && p.age <= hi); }; }
  function incR(x) { return function (p) { return p.income == null ? null : p.income <= x; }; }
  function occR() { var k = [].slice.call(arguments); return function (p) { return p.occ.size === 0 ? null : k.some(function (x) { return p.occ.has(x); }); }; }
  function areaR(a) { return function (p) { return p.area == null ? null : p.area === a; }; }
  function mb(f) { return function (p) { var v = f(p); return v === true ? "maybe" : v; }; }
  function any() {
    var fs = [].slice.call(arguments);
    return function (p) {
      var vs = fs.map(function (f) { return f(p); });
      if (vs.indexOf(true) > -1) return true;
      if (vs.indexOf("maybe") > -1) return "maybe";
      if (vs.indexOf(null) > -1) return null;
      return false;
    };
  }
  function womanR(minAge) { return function (p) { if (p.female == null || p.age == null) return null; return p.female && p.age >= minAge; }; }
  function eduR(levels) { return function (p) { if (!p.occ.has("student")) return false; if (p.edu === "none") return null; return levels.indexOf(p.edu) > -1; }; }
  var NOTGOV = R("Not a government employee", function (p) { return !p.occ.has("govt"); });
  var NOTAX = R("Household pays no income tax", function (p) { return !p.taxpayer; });
  var NOORG = R("Not already covered by EPFO, ESIC or NPS", function (p) { return !p.orgMember; });
  var UNORG = R("Works in the unorganised sector", occR("labour", "vendor", "artisan", "fisher", "tenant"), "what you do");

  /* ---------- schemes ---------- */
  var S = [
    { id: "pm-kisan", cat: "farm", name: "PM-KISAN", min: "Ministry of Agriculture & Farmers Welfare",
     benefit: "TEST: my first edit. Money goes straight to your bank account.",
      rules: [R("Farmer with cultivable land", occR("farmer"), "what you do"), NOTAX, NOTGOV],
      verify: ["Land record in your name, e-KYC and an Aadhaar-linked bank account are required", "Retired pensioners drawing ₹10,000 or more a month and professionals such as doctors and lawyers are excluded"],
      docs: ["aad", "bank", "land", "mob"], how: "Self-register on the PM-KISAN portal, or visit a Common Service Centre or your village agriculture officer.", url: "https://pmkisan.gov.in" },
    { id: "pmfby", cat: "farm", name: "PM Fasal Bima Yojana", min: "Ministry of Agriculture & Farmers Welfare",
      benefit: "Insurance against crop loss. You pay 2% of the sum insured for kharif, 1.5% for rabi and 5% for commercial and horticulture crops.",
      rules: [R("Farmer, tenant or sharecropper", occR("farmer", "tenant"), "what you do")],
      verify: ["The crop and area must be notified by your state for that season", "Enrol before the cut-off date, usually a few weeks after sowing"],
      docs: ["aad", "bank", "land", "tenancy"], how: "Apply through your bank, a Common Service Centre, the crop insurance portal or the PMFBY app.", url: "https://pmfby.gov.in" },
    { id: "kcc", cat: "farm", name: "Kisan Credit Card", min: "Ministry of Agriculture · banks",
      benefit: "Low-cost farm credit. With interest subvention and prompt repayment the effective rate on loans up to ₹3 lakh can be as low as 4%.",
      rules: [R("Farmer, tenant, sharecropper, fisher or livestock keeper", occR("farmer", "tenant", "fisher"), "what you do"), R("Aged 18 to 75", ageR(18, 75), "age")],
      verify: ["Co-applicant is needed if you are above 60", "Loan limit depends on your land, crop and the bank's assessment"],
      docs: ["aad", "land", "photo", "bank"], how: "Apply at any cooperative, regional rural or commercial bank branch, or through the PM-KISAN portal link.", url: "https://pmkisan.gov.in" },
    { id: "pm-kmy", cat: "farm", name: "PM Kisan Maandhan Yojana", min: "Ministry of Agriculture & Farmers Welfare",
      benefit: "₹3,000 a month pension from age 60. You pay ₹55 to ₹200 a month depending on your joining age, and the Centre adds an equal amount.",
      rules: [R("Aged 18 to 40", ageR(18, 40), "age"),
        R("Small or marginal farmer (up to 2 hectares)", function (p) { if (!p.occ.has("farmer")) return p.occ.size === 0 ? null : false; return p.land === "small" ? true : p.land === "large" ? false : null; }, "land size"), NOORG, NOTAX],
      verify: ["Needs an active savings bank account for monthly auto-debit"],
      docs: ["aad", "bank", "land", "mob"], how: "Enrol at a Common Service Centre with your Aadhaar and bank passbook.", url: "https://maandhan.in" },
    { id: "pmmsy", cat: "farm", name: "PM Matsya Sampada Yojana", min: "Department of Fisheries",
      benefit: "Subsidy of 40% on fisheries projects such as ponds, boats, nets and cold chains, and 60% for women and SC/ST applicants.",
      rules: [R("Fisher, fish farmer or fish vendor", occR("fisher"), "what you do")],
      verify: ["Projects are approved by the state fisheries department; subsidy depends on the project type and cost"],
      docs: ["aad", "bank", "photo", "addr"], how: "Apply through your district fisheries office or the scheme portal.", url: "https://pmmsy.dof.gov.in" },

    { id: "pmjay", cat: "health", name: "Ayushman Bharat PM-JAY", min: "National Health Authority", list: true,
      benefit: "Free hospital treatment up to ₹5 lakh per family per year at listed hospitals.",
      rules: [R("Low-income or deprived household", any(function (p) { return p.bpl; }, mb(incR(2.5))), "income band")],
      verify: ["Your family must appear in the beneficiary database (SECC 2011 or state lists). Several states cover more families.", "Check your name at the PM-JAY portal or at an empanelled hospital's Ayushman Mitra desk"],
      docs: ["aad", "ration", "mob"], how: "Check eligibility on the beneficiary portal, then get your Ayushman card at a Common Service Centre or hospital desk.", url: "https://pmjay.gov.in" },
    { id: "vay-vandana", cat: "health", name: "Ayushman Vay Vandana", min: "National Health Authority",
      benefit: "Health cover of ₹5 lakh per family per year for everyone aged 70 or above, whatever their income.",
      rules: [R("Aged 70 or above", ageR(70, 130), "age")],
      verify: ["Not available if you are covered under CGHS, ECHS or similar government schemes, unless you opt for this one"],
      docs: ["aad", "mob"], how: "Register on the Ayushman Vay Vandana portal or app with Aadhaar eKYC.", url: "https://beneficiary.nha.gov.in" },

    { id: "pmay-g", cat: "home", name: "PM Awas Yojana – Gramin", min: "Ministry of Rural Development", list: true,
      benefit: "₹1.2 lakh to build a pucca house in plains and ₹1.3 lakh in hilly and difficult areas, plus 90 days of MGNREGA labour and toilet support.",
      rules: [R("Lives in a rural area", areaR("rural"), "where you live"), R("Does not own a pucca house", function (p) { return !p.pucca; }), R("Low household income (about ₹15,000 a month or less)", incR(2), "income band")],
      verify: ["Selection is from the Awaas+ survey list approved by the Gram Sabha", "Exclusions such as a government job, income tax payment or owning certain vehicles apply"],
      docs: ["aad", "bank", "ration", "addr"], how: "Ask your Gram Panchayat or block office whether your household is on the permanent wait list, or self-survey on the Awaas+ app.", url: "https://pmayg.nic.in" },
    { id: "pmay-u", cat: "home", name: "PM Awas Yojana – Urban 2.0", min: "Ministry of Housing & Urban Affairs",
      benefit: "Up to ₹2.5 lakh central assistance to build or buy a home, or an interest subsidy on a home loan.",
      rules: [R("Lives in a town or city", areaR("urban"), "where you live"), R("Household income up to ₹9 lakh a year", incR(9), "income band"), R("No pucca house anywhere in India in the family", function (p) { return !p.pucca; })],
      verify: ["Income bands: EWS up to ₹3 lakh, LIG ₹3–6 lakh, MIG ₹6–9 lakh. Benefit type depends on the band.", "The urban local body verifies the application"],
      docs: ["aad", "income", "bank", "addr", "photo"], how: "Apply on the PMAY-Urban portal or through your urban local body or lending bank.", url: "https://pmaymis.gov.in" },
    { id: "surya-ghar", cat: "home", name: "PM Surya Ghar Muft Bijli Yojana", min: "Ministry of New and Renewable Energy",
      benefit: "Rooftop solar subsidy of ₹30,000 for 1 kW, ₹60,000 for 2 kW and ₹78,000 for 3 kW or more, with up to 300 free units a month.",
      rules: [R("Owns a house with a roof suitable for solar", function (p) { return p.pucca; })],
      verify: ["You need a valid household electricity connection and no earlier solar subsidy", "Installation must be done by a registered vendor"],
      docs: ["aad", "bill", "bank", "addr"], how: "Register on the PM Surya Ghar portal, pick a vendor, and get the subsidy after inspection.", url: "https://pmsuryaghar.gov.in" },

    { id: "ujjwala", cat: "food", name: "PM Ujjwala Yojana", min: "Ministry of Petroleum & Natural Gas",
      benefit: "A free LPG connection for the household, and a ₹300 subsidy per refill on up to 9 refills a year, as approved for 2025–26.",
      rules: [R("Woman aged 18 or above", womanR(18), "gender and age"), R("No LPG connection in the household", function (p) { return p.noLpg; }),
        R("Priority household: BPL or AAY, SC or ST, or a similar category", any(function (p) { return p.bpl; }, function (p) { return p.cat == null ? null : (p.cat === "sc" || p.cat === "st"); }, mb(incR(2.5))), "social category")],
      verify: ["Confirm the refill subsidy is still running for the current year", "Only one connection per household"],
      docs: ["aad", "ration", "bank", "photo", "caste"], how: "Apply with the KYC form at your nearest LPG distributor, or online on the Ujjwala portal.", url: "https://www.pmuy.gov.in" },
    { id: "nfsa", cat: "food", name: "Ration card (NFSA)", min: "Department of Food & Public Distribution", list: true,
      benefit: "5 kg of free foodgrain per person per month, and 35 kg per household for Antyodaya families.",
      rules: [R("Low-income household (cut-offs differ by state)", any(function (p) { return p.bpl; }, mb(incR(2.5))), "income band")],
      verify: ["Each state sets its own income limit and lists households as Priority or Antyodaya"],
      docs: ["aad", "income", "addr", "photo"], how: "Apply at your state food and civil supplies department portal or at the local ration office.", url: "https://nfsa.gov.in" },

    { id: "pmjdy", cat: "money", name: "PM Jan Dhan Yojana", min: "Department of Financial Services",
      benefit: "A zero-balance savings account with a RuPay debit card, ₹2 lakh accident cover and an overdraft of up to ₹10,000.",
      rules: [R("You do not have a bank account yet", function (p) { return p.noBank; }), R("Aged 10 or above", ageR(10, 130), "age")],
      verify: [], docs: ["aad", "photo", "mob"], how: "Walk into any bank branch or visit a Bank Mitra with your Aadhaar.", url: "https://pmjdy.gov.in" },
    { id: "pmsby", cat: "money", name: "PM Suraksha Bima Yojana", min: "Department of Financial Services",
      benefit: "₹2 lakh for accidental death or total disability, ₹1 lakh for partial disability, for ₹20 a year.",
      rules: [R("Aged 18 to 70", ageR(18, 70), "age"), R("Has a savings bank account", function (p) { return !p.noBank; })],
      verify: ["Premium is auto-debited each year around 31 May"], docs: ["aad", "bank"], how: "Enrol through your bank branch, net banking or a bank app.", url: "https://www.jansuraksha.gov.in" },
    { id: "pmjjby", cat: "money", name: "PM Jeevan Jyoti Bima Yojana", min: "Department of Financial Services",
      benefit: "₹2 lakh life cover for ₹436 a year, paid to your family on death from any cause.",
      rules: [R("Aged 18 to 50", ageR(18, 50), "age"), R("Has a savings bank account", function (p) { return !p.noBank; })],
      verify: ["Cover continues to age 55 while you renew each year"], docs: ["aad", "bank"], how: "Enrol through your bank branch, net banking or a bank app.", url: "https://www.jansuraksha.gov.in" },
    { id: "apy", cat: "money", name: "Atal Pension Yojana", min: "PFRDA · Department of Financial Services",
      benefit: "A guaranteed pension of ₹1,000 to ₹5,000 a month from age 60, depending on what you contribute.",
      rules: [R("Aged 18 to 40", ageR(18, 40), "age"), R("Has a savings bank account", function (p) { return !p.noBank; }), NOTAX],
      verify: ["Monthly contribution is auto-debited; it depends on your joining age and the pension you choose"], docs: ["aad", "bank", "mob"], how: "Open an APY account at your bank branch or through net banking.", url: "https://www.jansuraksha.gov.in" },
    { id: "pm-sym", cat: "money", name: "PM Shram Yogi Maandhan", min: "Ministry of Labour & Employment",
      benefit: "₹3,000 a month pension from age 60. You pay ₹55 to ₹200 a month and the Centre matches it.",
      rules: [R("Aged 18 to 40", ageR(18, 40), "age"), UNORG, R("Monthly income of ₹15,000 or less", incR(2), "income band"), NOORG, NOTAX],
      verify: ["The income limit applies to the worker's own monthly earnings"], docs: ["aad", "bank", "mob"], how: "Enrol at a Common Service Centre with your Aadhaar and savings account.", url: "https://maandhan.in" },
    { id: "eshram", cat: "money", name: "e-Shram card", min: "Ministry of Labour & Employment",
      benefit: "A national ID for unorganised workers with ₹2 lakh accident insurance for the first year, and easier access to welfare schemes.",
      rules: [R("Aged 16 to 59", ageR(16, 59), "age"), UNORG, NOORG, NOTAX],
      verify: [], docs: ["aad", "mob", "bank"], how: "Self-register on the e-Shram portal or visit a Common Service Centre.", url: "https://eshram.gov.in" },

    { id: "svanidhi", cat: "work", name: "PM SVANidhi", min: "Ministry of Housing & Urban Affairs",
      benefit: "Collateral-free working-capital loans: ₹15,000, then ₹25,000, then ₹50,000 as you repay, with interest subsidy and digital-payment rewards. Lending runs to March 2030.",
      rules: [R("Street vendor", occR("vendor"), "what you do")],
      verify: ["You need a vending certificate or a letter of recommendation from your urban local body", "Coverage is extending to census towns and peri-urban areas in phases"],
      docs: ["aad", "vend", "bank", "mob"], how: "Apply on the PM SVANidhi portal or through a bank, microfinance lender or Common Service Centre.", url: "https://pmsvanidhi.mohua.gov.in" },
    { id: "mudra", cat: "work", name: "PM Mudra Yojana", min: "Ministry of Finance · MUDRA",
      benefit: "Collateral-free business loans: Shishu up to ₹50,000, Kishor to ₹5 lakh, Tarun to ₹10 lakh, and Tarun Plus to ₹20 lakh for earlier good repayers.",
      rules: [R("Runs or plans a non-farm business", occR("business", "vendor", "artisan", "unemployed"), "what you do"), R("Aged 18 or above", ageR(18, 130), "age")],
      verify: ["The lender assesses your business plan and repayment record"], docs: ["aad", "pan", "bus", "bank", "photo"], how: "Apply at any bank, NBFC or microfinance lender, or on the Udyamimitra portal.", url: "https://www.mudra.org.in" },
    { id: "standup", cat: "work", name: "Stand-Up India", min: "Department of Financial Services · SIDBI", list: true,
      benefit: "Bank loans of ₹10 lakh to ₹1 crore for a first-time manufacturing, services or trading enterprise.",
      rules: [R("Woman, or SC or ST applicant", any(function (p) { return p.female; }, function (p) { return p.cat == null ? null : (p.cat === "sc" || p.cat === "st"); }), "gender or social category"),
        R("Starting a new enterprise", occR("business", "unemployed", "homemaker", "artisan"), "what you do"), R("Aged 18 or above", ageR(18, 130), "age")],
      verify: ["Check the scheme's current status. The 2025 Budget announced a new term-loan scheme for first-time women, SC and ST entrepreneurs.", "The loan is for a first-time venture"],
      docs: ["aad", "pan", "caste", "bus", "bank"], how: "Apply through the Stand-Up Mitra portal or a bank branch.", url: "https://www.standupmitra.in" },
    { id: "pmegp", cat: "work", name: "PMEGP", min: "Ministry of MSME · KVIC",
      benefit: "A 15% to 35% subsidy on the cost of a new micro enterprise. The rate is higher for women, SC/ST, OBC, minorities and rural applicants.",
      rules: [R("Aged 18 or above", ageR(18, 130), "age"), R("Starting a new enterprise", occR("business", "unemployed", "artisan", "homemaker"), "what you do"), NOTGOV],
      verify: ["Class 8 pass is needed for projects above ₹10 lakh (manufacturing) or ₹5 lakh (services)", "Not for units that already received another government subsidy"],
      docs: ["aad", "pan", "bus", "caste", "bank", "edu"], how: "Apply on the PMEGP e-portal; your district KVIC, KVIB or industries centre guides the process.", url: "https://www.kviconline.gov.in/pmegpeportal" },
    { id: "vishwakarma", cat: "work", name: "PM Vishwakarma", min: "Ministry of MSME",
      benefit: "A ₹500 a day stipend during skill training, a ₹15,000 toolkit voucher, and collateral-free loans of ₹1 lakh then ₹2 lakh at 5% interest.",
      rules: [R("Artisan or craftsperson in a listed trade", occR("artisan"), "what you do"), R("Aged 18 or above", ageR(18, 130), "age"), NOTGOV],
      verify: ["Your trade must be one of the 18 listed (carpenter, blacksmith, potter, tailor, barber and others)", "Not for those who took a PMEGP, Mudra or SVANidhi loan in the last 5 years"],
      docs: ["aad", "mob", "bank", "bus", "photo"], how: "Register at a Common Service Centre; your gram panchayat or urban body verifies the trade.", url: "https://pmvishwakarma.gov.in" },
    { id: "nrlm", cat: "work", name: "DAY-NRLM (self-help groups)", min: "Ministry of Rural Development",
      benefit: "Join a women's self-help group for a revolving fund, community investment support and bank loans at low interest.",
      rules: [R("Woman aged 18 or above", womanR(18), "gender and age"), R("Lives in a rural area", areaR("rural"), "where you live"), R("Low-income household", any(function (p) { return p.bpl; }, mb(incR(2.5))), "income band")],
      verify: ["Groups are formed by the village organisation; priority goes to poor and vulnerable households"],
      docs: ["aad", "bank", "ration", "photo"], how: "Contact your block office or the nearest SHG, village organisation or Jeevika/Umeed-type state mission.", url: "https://aajeevika.gov.in" },
    { id: "pmkvy", cat: "work", name: "PMKVY skill training", min: "Ministry of Skill Development",
      benefit: "Free short-term skill training with certification and placement support.",
      rules: [R("Aged 15 to 45", ageR(15, 45), "age"), R("Student, jobless, labourer or homemaker", occR("student", "unemployed", "labour", "homemaker"), "what you do")],
      verify: ["Seats and courses depend on your district's training centres"], docs: ["aad", "bank", "edu", "photo"], how: "Search a course and centre on the Skill India Digital portal.", url: "https://www.skillindiadigital.gov.in" },
    { id: "pmis", cat: "work", name: "PM Internship Scheme", min: "Ministry of Corporate Affairs",
      benefit: "A 12-month paid internship at a top company, with a monthly stipend (₹9,000 minimum as reported in 2026) and insurance.",
      rules: [R("Aged 21 to 24, or a final-year student aged 18 to 25", any(ageR(21, 24), function (p) { return p.occ.has("student") && p.age != null && p.age >= 18 && p.age <= 25 ? "maybe" : (p.age == null ? null : false); }), "age"),
        R("Not in a full-time job", function (p) { return !p.occ.has("salaried") && !p.occ.has("govt"); }), R("Household income up to ₹8 lakh", incR(8), "income band")],
      verify: ["No one in your family may hold a government job", "Graduates of IIT, IIM, IISER and professionals such as CA or CMA are excluded", "Final-year students need a No Objection Certificate from their institution"],
      docs: ["aad", "edu", "bank", "income"], how: "Create a profile on the PM Internship portal and apply during the open window.", url: "https://pminternship.mca.gov.in" },

    { id: "ssy", cat: "family", name: "Sukanya Samriddhi Yojana", min: "Ministry of Finance · India Post",
      benefit: "A high-interest savings account for a girl child with tax benefits. Deposit ₹250 to ₹1.5 lakh a year; the account matures when she is 21.",
      rules: [R("Girl child under 10 in the family", function (p) { return p.girl; })],
      verify: ["Up to two girls per family, or three if twins", "The interest rate is set by the government every quarter"],
      docs: ["birth", "aad", "addr", "photo"], how: "Open the account at a post office or authorised bank with a parent or guardian.", url: "https://www.indiapost.gov.in" },
    { id: "pmmvy", cat: "family", name: "PM Matru Vandana Yojana", min: "Ministry of Women & Child Development",
      benefit: "₹5,000 for the first living child, and ₹6,000 if the second child is a girl, paid into your bank account.",
      rules: [R("Woman aged 19 or above", womanR(19), "gender and age"), R("Pregnant or breastfeeding", function (p) { return p.pregnant; }), R("Not a regular government or PSU employee", function (p) { return !p.occ.has("govt"); })],
      verify: ["Register at an Anganwadi centre or health facility during pregnancy"],
      docs: ["aad", "bank", "mcp", "mob"], how: "Register with your Anganwadi worker, ASHA or the nearest health facility.", url: "https://pmmvy.wcd.gov.in" },
    { id: "ignoaps", cat: "family", name: "Old-age pension (IGNOAPS)", min: "Ministry of Rural Development · NSAP", list: true,
      benefit: "Central pension of ₹200 a month for ages 60 to 79 and ₹500 from 80. Many states add their own top-up.",
      rules: [R("Aged 60 or above", ageR(60, 130), "age"), R("Family has a BPL, AAY or priority card", function (p) { return p.bpl; })],
      verify: ["The amount and the BPL test vary by state"], docs: ["aad", "age", "ration", "bank", "photo"], how: "Apply at your gram panchayat, block office or the state social welfare portal.", url: "https://nsap.nic.in" },
    { id: "ignwps", cat: "family", name: "Widow pension (IGNWPS)", min: "Ministry of Rural Development · NSAP", list: true,
      benefit: "Central pension of ₹300 a month for widows aged 40 to 79, usually topped up by the state.",
      rules: [R("Woman aged 40 to 79", function (p) { if (p.female == null || p.age == null) return null; return p.female && p.age >= 40 && p.age <= 79; }, "gender and age"), R("Widow", function (p) { return p.widow; }), R("Family has a BPL, AAY or priority card", function (p) { return p.bpl; })],
      verify: ["The amount and conditions vary by state"], docs: ["aad", "death", "ration", "bank", "age"], how: "Apply at your gram panchayat, block office or the state social welfare portal.", url: "https://nsap.nic.in" },
    { id: "igndps", cat: "family", name: "Disability pension (IGNDPS)", min: "Ministry of Rural Development · NSAP", list: true,
      benefit: "Central pension of ₹300 a month for people with severe disability, usually topped up by the state.",
      rules: [R("Aged 18 to 79", ageR(18, 79), "age"), R("Disability of 80% or more", function (p) { return p.disab === "80"; }), R("Family has a BPL, AAY or priority card", function (p) { return p.bpl; })],
      verify: ["The amount and conditions vary by state"], docs: ["aad", "udid", "ration", "bank", "photo"], how: "Apply at your gram panchayat, block office or the state social welfare portal.", url: "https://nsap.nic.in" },
    { id: "vayoshri", cat: "family", name: "Rashtriya Vayoshri Yojana", min: "Ministry of Social Justice & Empowerment",
      benefit: "Free walking sticks, hearing aids, spectacles, wheelchairs and other aids for seniors, given at assessment camps.",
      rules: [R("Aged 60 or above", ageR(60, 130), "age"), R("Low income (BPL or up to ₹15,000 a month)", any(function (p) { return p.bpl; }, mb(incR(2))), "income band")],
      verify: ["You must have an age-related impairment such as low vision, hearing loss or difficulty moving, confirmed at a camp"],
      docs: ["aad", "age", "income", "photo"], how: "Watch for camps announced by your district social welfare office or register through ALIMCO.", url: "https://alimco.in" },
    { id: "adip", cat: "family", name: "ADIP aids and appliances", min: "Dept. of Empowerment of Persons with Disabilities",
      benefit: "Free or subsidised aids such as wheelchairs, hearing aids, prosthetics and mobility devices.",
      rules: [R("Disability of 40% or more", function (p) { return p.disab === "40" || p.disab === "80"; }), R("Income up to ₹20,000 a month", any(function (p) { return p.bpl; }, mb(incR(2.5))), "income band")],
      verify: ["Full subsidy applies up to ₹15,000 a month; part subsidy up to ₹20,000"],
      docs: ["udid", "aad", "income", "photo"], how: "Apply at a district ADIP camp or through the implementing agency, with a UDID card from the Swavlamban portal.", url: "https://disabilityaffairs.gov.in" },

    { id: "sc-pms", cat: "edu", name: "Post-matric scholarship for SC", min: "Ministry of Social Justice & Empowerment",
      benefit: "Tuition and fee support plus a monthly maintenance allowance for SC students after Class 10.",
      rules: [R("SC student in Class 11 or above", function (p) { if (!p.occ.has("student")) return false; if (p.cat == null) return null; if (p.cat !== "sc") return false; if (p.edu === "none") return null; return ["school11_12", "ug", "pg"].indexOf(p.edu) > -1; }, "social category and education"), R("Family income up to ₹2.5 lakh", incR(2.5), "income band")],
      verify: ["Apply every year before the portal deadline"], docs: ["caste", "income", "marks", "fee", "bank", "aad"], how: "Apply on the National Scholarship Portal; your institution verifies the application.", url: "https://scholarships.gov.in" },
    { id: "st-pms", cat: "edu", name: "Post-matric scholarship for ST", min: "Ministry of Tribal Affairs",
      benefit: "Compulsory fees and a monthly maintenance allowance for ST students after Class 10.",
      rules: [R("ST student in Class 11 or above", function (p) { if (!p.occ.has("student")) return false; if (p.cat == null) return null; if (p.cat !== "st") return false; if (p.edu === "none") return null; return ["school11_12", "ug", "pg"].indexOf(p.edu) > -1; }, "social category and education"), R("Family income up to ₹2.5 lakh", incR(2.5), "income band")],
      verify: ["Apply every year before the portal deadline"], docs: ["caste", "income", "marks", "fee", "bank", "aad"], how: "Apply on the National Scholarship Portal; your institution verifies the application.", url: "https://scholarships.gov.in" },
    { id: "yasasvi", cat: "edu", name: "PM YASASVI scholarship", min: "Ministry of Social Justice & Empowerment",
      benefit: "Scholarship support for OBC, EBC and DNT students from Class 9 onwards.",
      rules: [R("OBC student in Class 9 or above", function (p) { if (!p.occ.has("student")) return false; if (p.cat == null) return null; if (p.cat !== "obc") return false; return p.edu === "none" ? null : true; }, "social category and education"), R("Family income up to ₹2.5 lakh", incR(2.5), "income band")],
      verify: ["Amounts and course coverage differ by level"], docs: ["caste", "income", "marks", "fee", "bank", "aad"], how: "Apply on the National Scholarship Portal.", url: "https://scholarships.gov.in" },
    { id: "minority-sch", cat: "edu", name: "Minority scholarships", min: "Ministry of Minority Affairs",
      benefit: "Scholarships for minority students: post-matric, merit-cum-means for professional courses, and pre-matric for Classes 9 and 10.",
      rules: [R("Student from a notified minority", function (p) { return p.occ.has("student") && p.minority; }), R("Family income up to ₹2.5 lakh", any(incR(2), mb(incR(2.5))), "income band")],
      verify: ["At least 50% marks in the previous exam", "Income limit is ₹1 lakh for Classes 9–10, ₹2 lakh for post-matric and ₹2.5 lakh for merit-cum-means"],
      docs: ["minority", "income", "marks", "fee", "bank", "aad"], how: "Apply on the National Scholarship Portal.", url: "https://scholarships.gov.in" },
    { id: "cs-college", cat: "edu", name: "Central Sector Scholarship for college students", min: "Department of Higher Education",
      benefit: "About ₹12,000 a year for graduation and ₹20,000 a year for post-graduation, based on merit.",
      rules: [R("Studying in college or university", eduR(["ug", "pg"]), "education"), R("Family income up to ₹4.5 lakh", incR(4.5), "income band")],
      verify: ["You must be above the 80th percentile in your Class 12 board stream", "Regular full-time course"], docs: ["marks", "income", "fee", "bank", "aad"], how: "Apply on the National Scholarship Portal.", url: "https://scholarships.gov.in" }
  ];

  /* ---------- state schemes (Karnataka, Maharashtra, Tamil Nadu, Uttar Pradesh) ---------- */
  var FEM = R("Woman", function (p) { return p.female; }, "gender");
  var WOMAN_OR_TG = R("Woman or transgender person", function (p) { return p.gender === "" ? null : (p.gender === "female" || p.gender === "other"); }, "gender");
  var MALE = R("Man", function (p) { return p.gender === "" ? null : p.gender === "male"; }, "gender");
  var LOWINC = R("Very low family income (below about ₹46,000 rural or ₹56,000 urban a year)", any(function (p) { return p.bpl; }, mb(incR(1))), "income band");
  var UPNOTE = "Income ceilings and the ₹1,000 monthly amount come from secondary sources. Confirm them on the pension portal.";
  S = S.concat([
    { id: "ka-gruha-lakshmi", state: "KA", cat: "family", name: "Gruha Lakshmi", min: "Government of Karnataka · Women & Child Development",
      benefit: "₹2,000 a month to the woman head of the family, paid by direct bank transfer.",
      rules: [FEM, NOTGOV, R("Neither you nor your husband pays income tax or GST", function (p) { return !p.taxpayer; })],
      verify: ["You must be the head of family on an Antyodaya, BPL or APL ration card. One woman per family.", "Age and income conditions are not confirmed here. Check on Seva Sindhu."],
      note: "Payments are reported to be delayed. Instalments from early 2025 were still unpaid in November 2026 and the state has told the High Court it lacks funds. Check the latest status before you rely on it.",
      docs: ["aad", "ration", "bank"], how: "Apply on the Seva Sindhu guarantee portal, or at a Grama One, Bangalore One, Karnataka One or Nada Kacheri centre.", url: "https://sevasindhu.karnataka.gov.in" },
    { id: "ka-gruha-jyothi", state: "KA", cat: "home", name: "Gruha Jyothi", min: "Government of Karnataka · Energy Department",
      benefit: "Free electricity for your home: your free quota is your 2022–23 average use plus 10%, as long as that average is under 200 units a month.",
      rules: [R("Household with a domestic electricity connection", function () { return true; })],
      verify: ["Aadhaar must be linked to your electricity consumer ID", "One connection per owner. Tenants qualify with a rental agreement. Commercial connections are excluded."],
      docs: ["aad", "bill", "tenancy"], how: "Apply on the Gruha Jyothi portal with your electricity account ID, or at a Grama Panchayat, Nada Kacheri, Bangalore One or Karnataka One centre.", url: "https://sevasindhugs.karnataka.gov.in" },
    { id: "ka-anna-bhagya", state: "KA", cat: "food", name: "Anna Bhagya", min: "Government of Karnataka · Food & Civil Supplies",
      benefit: "Free foodgrain for BPL and Antyodaya families: 5 kg of rice per person per month from the central quota.",
      rules: [R("Family has a BPL, AAY or priority card", function (p) { return p.bpl; })],
      verify: ["The BPL income ceiling is reported as ₹1.2 lakh a year"],
      note: "The state's extra 5 kg of rice was replaced by cash in 2023. In October 2025 the cabinet approved a monthly ‘Indira Kit’ of dal, sugar, oil and salt in its place. Confirm what is being given in your district.",
      docs: ["ration", "aad"], how: "No separate application beyond your ration card. Ask your fair-price shop or the food department.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "ka-yuva-nidhi", state: "KA", cat: "work", name: "Yuva Nidhi", min: "Government of Karnataka", list: true,
      benefit: "₹3,000 a month for unemployed graduates and ₹1,500 for diploma holders, for up to 2 years or until you find work.",
      rules: [R("Unemployed", occR("unemployed"), "what you do"), R("Aged 18 or above", ageR(18, 130), "age")],
      verify: ["You must have passed a degree or diploma and stayed unemployed for 6 months. The first batch was 2022–23, so check whether your batch qualifies.", "A monthly self-declaration on Seva Sindhu is needed, or that month is not paid", "Not for people in higher studies, apprenticeships, or self-employed with a loan"],
      docs: ["edu", "aad", "bank"], how: "Apply on the Seva Sindhu guarantee portal.", url: "https://sevasindhu.karnataka.gov.in" },
    { id: "ka-shakti", state: "KA", cat: "family", name: "Shakti free bus travel", min: "Government of Karnataka · Transport",
      benefit: "Free travel for women and transgender persons on ordinary and express buses of the state transport corporations within Karnataka. Luxury, AC and inter-state buses are excluded.",
      rules: [WOMAN_OR_TG],
      verify: ["Carry a government photo ID. Smart cards were approved in February 2026 and are not yet mandatory, according to reports."],
      docs: ["aad", "photo", "domicile"], how: "Show your ID to the conductor for a zero-value ticket, or apply for a Shakti smart card on Seva Sindhu.", url: "https://sevasindhu.karnataka.gov.in" },

    { id: "up-ksy", state: "UP", cat: "family", name: "Mukhyamantri Kanya Sumangala Yojana", min: "Women Welfare Department, Uttar Pradesh",
      benefit: "₹25,000 for a daughter, paid in stages from birth through graduation.",
      rules: [R("Girl child under 10 in the family", function (p) { return p.girl; }), R("Family income up to ₹3 lakh a year", incR(3), "income band")],
      verify: ["Permanent UP resident", "Covers up to two daughters and two children per family, with an exception for twins"],
      note: "The ₹25,000 total and its instalment split come from secondary sources. Confirm the amounts on the official portal.",
      docs: ["addr", "aad", "bank", "birth"], how: "Apply online on the Citizen Services Portal of the Women Welfare Directorate.", url: "https://www.mksy.up.gov.in/women_welfare/citizen/check-eligibility.php" },
    { id: "up-oap", state: "UP", cat: "family", name: "UP old-age pension", min: "Social Welfare Department, Uttar Pradesh", list: true,
      benefit: "₹1,000 a month, paid every quarter by direct bank transfer.",
      rules: [R("Aged 60 or above", ageR(60, 130), "age"), LOWINC],
      verify: ["Permanent UP resident, with no other government pension"], note: UPNOTE,
      docs: ["aad", "bank", "income", "age", "addr"], how: "Apply online on the pension portal, or at a Jan Seva Kendra. The gram panchayat or ward verifies the application.", url: "https://sspy-up.gov.in" },
    { id: "up-widow", state: "UP", cat: "family", name: "UP widow pension", min: "Social Welfare Department, Uttar Pradesh", list: true,
      benefit: "₹1,000 a month for destitute women and widows, paid every quarter by direct bank transfer.",
      rules: [FEM, R("Widow", function (p) { return p.widow; }), R("Aged 18 to 60", ageR(18, 60), "age"), LOWINC],
      verify: ["Permanent UP resident, with no other government pension", "The upper age limit is shown as 59 on some pages and 60 on others"], note: UPNOTE,
      docs: ["aad", "death", "bank", "income", "age", "addr"], how: "Apply online on the pension portal, or at a Jan Seva Kendra.", url: "https://sspy-up.gov.in" },
    { id: "up-disability", state: "UP", cat: "family", name: "UP disability pension", min: "Social Welfare Department, Uttar Pradesh", list: true,
      benefit: "₹1,000 a month for people with 40% or more disability, paid every quarter by direct bank transfer.",
      rules: [R("Disability of 40% or more", function (p) { return p.disab === "40" || p.disab === "80"; }), LOWINC],
      verify: ["Permanent UP resident, with no other government pension", "The age range is not confirmed"], note: UPNOTE,
      docs: ["aad", "udid", "bank", "income", "addr"], how: "Apply online on the pension portal, or at a Jan Seva Kendra.", url: "https://sspy-up.gov.in" },
    { id: "up-tablet", state: "UP", cat: "edu", name: "Free tablet for students", min: "Government of Uttar Pradesh", list: true,
      benefit: "A free tablet for students in approved degree, diploma and professional courses.",
      rules: [R("Student in college or university", eduR(["ug", "pg"]), "education")],
      verify: ["Your institution submits your details to the state portal. You do not apply yourself.", "Only recognised UP institutions and approved courses qualify"],
      note: "A new round was reported to start in November 2026, from a single secondary source. Confirm with your institution.",
      docs: ["aad", "mob", "fee"], how: "Ask your college whether it has registered your details.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },

    { id: "mh-ladki-bahin", state: "MH", cat: "family", name: "Mukhyamantri Majhi Ladki Bahin Yojana", min: "Government of Maharashtra", list: true,
      benefit: "₹1,500 a month for eligible women, paid by direct bank transfer.",
      rules: [R("Woman aged 21 to 65", function (p) { if (p.female == null || p.age == null) return null; return p.female && p.age >= 21 && p.age <= 65; }, "gender and age"), R("Family income up to ₹2.5 lakh a year", incR(2.5), "income band"), NOTAX, NOTGOV],
      verify: ["An Aadhaar-linked bank account and yearly e-KYC are compulsory", "Families with a four-wheeler and women already getting Namo Shetkari are excluded"],
      note: "The scheme has been heavily pruned. Reports say 80 lakh or more women were removed after the 2026 e-KYC deadline, and some women report missed instalments. Check your status on the portal.",
      docs: ["aad", "bank", "income", "domicile"], how: "Apply or check status on the Ladki Bahin portal.", url: "https://ladakibahin.maharashtra.gov.in" },
    { id: "mh-mjpjay", state: "MH", cat: "health", name: "Mahatma Jyotiba Phule Jan Arogya Yojana", min: "State Health Assurance Society, Maharashtra", list: true,
      benefit: "Cashless hospital treatment up to ₹5 lakh per family per year. It has run together with Ayushman Bharat PM-JAY since July 2024.",
      rules: [R("Maharashtra resident family", function () { return true; })],
      verify: ["Families are identified from ration card and SECC records. A 2023 order reportedly extended cover to all state families, so check with a hospital desk."],
      docs: ["ration", "aad"], how: "Visit the Arogyamitra desk at an empanelled hospital with your ration card and Aadhaar.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "mh-sgny", state: "MH", cat: "family", name: "Sanjay Gandhi Niradhar and Shravanbal pension", min: "Social Justice Department, Maharashtra", list: true,
      benefit: "A monthly pension for destitute and elderly people, reported at ₹1,500 a month.",
      rules: [R("Aged 65 or above, or aged 18 to 64 and destitute (widow, disabled or seriously ill)", function (p) { if (p.age == null) return null; if (p.age >= 65) return true; if (p.age >= 18) return (p.widow || p.disab !== "none") ? true : "maybe"; return false; }, "age"),
        R("Very low family income (below about ₹21,000 a year)", any(function (p) { return p.bpl; }, mb(incR(1))), "income band")],
      verify: ["Resident of Maharashtra for 15 years, with no other pension"],
      note: "The amount comes from a third-party page. Older pages still show ₹600 to ₹900, so confirm the current rate.",
      docs: ["aad", "age", "income", "addr", "bank", "udid"], how: "Apply at your Talathi or Tahsildar office.", url: "https://sjsa.maharashtra.gov.in" },
    { id: "mh-lek-ladki", state: "MH", cat: "family", name: "Lek Ladki Yojana", min: "Government of Maharashtra",
      benefit: "₹1,01,000 in stages for a girl, from birth until age 18.",
      rules: [R("Girl child under 10 in the family", function (p) { return p.girl; }), R("Yellow or orange ration card family", any(function (p) { return p.bpl; }, mb(incR(1))), "income band")],
      verify: ["The girl must be born on or after 1 April 2023", "New births must apply within a year. Earlier eligible girls can apply until 15 August 2027."],
      docs: ["birth", "aad", "ration", "bank"], how: "Apply online on the Aaple Sarkar portal.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "mh-cmykpy", state: "MH", cat: "work", name: "Mukhyamantri Yuva Karya Prashikshan Yojana", min: "Skills, Employment & Entrepreneurship Department, Maharashtra", list: true,
      benefit: "Six months of on-the-job training with a monthly stipend: ₹6,000 (12th pass), ₹8,000 (ITI or diploma) or ₹10,000 (graduate).",
      rules: [R("Aged 18 to 35", ageR(18, 35), "age"), R("Looking for work", occR("unemployed"), "what you do")],
      verify: ["12th pass or higher", "Register as a job seeker on the Mahaswayam portal, with an Aadhaar-linked bank account"],
      note: "The current application window is not confirmed. The official note is undated.",
      docs: ["aad", "bank", "edu"], how: "Register on the Mahaswayam portal and contact your district skill centre.", url: "https://cmykpy.mahaswayam.gov.in" },

    { id: "tn-kmut", state: "TN", cat: "family", name: "Kalaignar Magalir Urimai Thogai", min: "Government of Tamil Nadu", list: true,
      benefit: "₹1,000 a month to the woman head of the family.",
      rules: [FEM, R("Family income up to ₹2.5 lakh a year", incR(2.5), "income band"), NOTGOV, NOTAX],
      verify: ["One woman per ration card", "Land under 5 acres irrigated or 10 acres dry, and household electricity use under 3,600 units a year", "Four-wheeler owners are reported to be excluded"],
      note: "The new state government kept the ₹1,000 payment, but a rise and a rename are reportedly under review. Treat reported changes as proposals until they are announced.",
      docs: ["ration", "aad", "bank"], how: "Apply through the camps or channel announced for the current phase.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "tn-pudhumai-penn", state: "TN", cat: "edu", name: "Pudhumai Penn", min: "Government of Tamil Nadu",
      benefit: "₹1,000 a month for girls from government schools who go on to higher education.",
      rules: [FEM, R("Student in a college, diploma or polytechnic course", eduR(["ug"]), "education")],
      verify: ["You must have studied Classes 6 to 12 in a government school", "Your college principal applies for you. Students cannot apply directly."],
      docs: ["aad", "edu", "addr", "mob"], how: "Ask your college principal to enrol you on the Pudhumai Penn portal.", url: "https://www.pudhumaipenn.tn.gov.in/" },
    { id: "tn-pudhalvan", state: "TN", cat: "edu", name: "Tamil Pudhalvan", min: "Government of Tamil Nadu",
      benefit: "₹1,000 a month for boys from government schools who go on to higher education.",
      rules: [MALE, R("Student in a college, diploma or polytechnic course", eduR(["ug"]), "education")],
      verify: ["You must have studied in a government or government-aided school", "Your Aadhaar number must match your school record"],
      note: "The monthly payment pattern is from news reports. Confirm it on the official channel.",
      docs: ["aad", "edu", "fee"], how: "Apply through your college or the online form, then wait for verification.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "tn-cmchis", state: "TN", cat: "health", name: "Chief Minister's Comprehensive Health Insurance", min: "Government of Tamil Nadu",
      benefit: "Cashless hospital treatment up to ₹5 lakh per family per year. An increase to ₹25 lakh has been announced without a date.",
      rules: [R("Family income of about ₹1.2 lakh a year or less", any(incR(1), mb(incR(1.5))), "income band")],
      verify: ["You need an income certificate from the Village Administrative Officer", "Not for families already covered by another health insurance"],
      docs: ["income", "ration", "aad"], how: "Register at the district collectorate. The helpline is 104.", url: "https://www.myscheme.gov.in", urlLabel: "Search on myScheme" },
    { id: "tn-pension", state: "TN", cat: "family", name: "Old-age and destitute widow pension", min: "Revenue Administration, Tamil Nadu", list: true,
      benefit: "₹1,200 a month, with a one-time ₹2,000 relief reported in March 2026.",
      rules: [R("Aged 60 or above, or a widow", any(ageR(60, 130), function (p) { return p.female && p.widow ? true : false; }), "age"), R("Family has a BPL, AAY or priority card", function (p) { return p.bpl; })],
      verify: ["Destitute and not working. Older pages mention age 65, so check the current limit."],
      note: "Payments are moving to direct bank transfer, and some delays were reported in August 2026.",
      docs: ["aad", "ration", "bank", "age", "photo"], how: "Apply on the state pension portal.", url: "https://cra.tn.gov.in" }
  ]);

  /* ---------- state ---------- */
  var KEY = "sea.profile.v1";
  function blank() { var f = {}; FLAGS.forEach(function (x) { f[x[0]] = false; }); return { state: "", age: "", gender: "", income: "", cat: "", area: "", minority: false, occ: [], land: "na", edu: "none", disab: "none", flags: f, example: false }; }
  function sample() { var s = blank(); s.state = "UP"; s.age = "34"; s.gender = "female"; s.income = "2.5"; s.cat = "obc"; s.area = "rural"; s.occ = ["farmer"]; s.land = "small"; s.flags.bpl = true; s.flags.noLpg = true; s.flags.girl = true; s.example = true; return s; }
  var state;
  try { var saved = localStorage.getItem(KEY); state = saved ? JSON.parse(saved) : sample(); } catch (e) { state = sample(); }
  if (!state || !state.flags) state = sample();
  if (state.state == null) state.state = "";
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var filterCat = "all", query = "";
  var $ = function (id) { return document.getElementById(id); };

  function derive(s) {
    var p = { state: s.state, gender: s.gender, age: s.age === "" ? null : Number(s.age), female: s.gender === "" ? null : s.gender === "female", income: s.income === "" ? null : Number(s.income),
      cat: s.cat || null, minority: !!s.minority, area: s.area || null, occ: new Set(s.occ), land: s.land, edu: s.edu, disab: s.disab };
    FLAGS.forEach(function (x) { p[x[0]] = !!s.flags[x[0]]; });
    return p;
  }

  function evaluate(s, p) {
    var rs = s.rules.map(function (r) { return { l: r.l, v: r.f(p), need: r.need }; });
    var fail = rs.filter(function (r) { return r.v === false; })[0];
    if (fail) return { status: "no", rs: rs, fail: fail };
    if (rs.some(function (r) { return r.v === null; })) return { status: "info", rs: rs };
    var soft = s.list || rs.some(function (r) { return r.v === "maybe"; });
    return { status: soft ? "possible" : "strong", rs: rs };
  }

  /* ---------- form ---------- */
  function buildForm() {
    $("occ").innerHTML = OCC.map(function (o) { return '<label class="chip"><input type="checkbox" data-occ="' + o[0] + '"><span>' + o[1] + "</span></label>"; }).join("");
    $("flags").innerHTML = FLAGS.map(function (f) { return '<label class="check"><input type="checkbox" data-flag="' + f[0] + '"><span>' + f[1] + "</span></label>"; }).join("");
  }
  function writeForm() {
    ["state", "age", "gender", "income", "cat", "area", "land", "edu", "disab"].forEach(function (k) { $(k).value = state[k]; });
    $("minority").checked = !!state.minority;
    document.querySelectorAll("[data-occ]").forEach(function (el) { el.checked = state.occ.indexOf(el.getAttribute("data-occ")) > -1; });
    document.querySelectorAll("[data-flag]").forEach(function (el) { el.checked = !!state.flags[el.getAttribute("data-flag")]; });
    $("exampleNote").hidden = !state.example;
  }
  function readForm() {
    ["state", "age", "gender", "income", "cat", "area", "land", "edu", "disab"].forEach(function (k) { state[k] = $(k).value; });
    state.minority = $("minority").checked;
    state.occ = [].slice.call(document.querySelectorAll("[data-occ]")).filter(function (e) { return e.checked; }).map(function (e) { return e.getAttribute("data-occ"); });
    document.querySelectorAll("[data-flag]").forEach(function (e) { state.flags[e.getAttribute("data-flag")] = e.checked; });
    state.example = false;
    $("exampleNote").hidden = true;
  }

  /* ---------- render ---------- */
  var MARK = { t: ["t", "✓", "Met"], m: ["m", "≈", "Confirm"], n: ["n", "?", "Needs your answer"], f: ["f", "✕", "Not met"] };
  function markFor(v) { return v === true ? MARK.t : v === "maybe" ? MARK.m : v === null ? MARK.n : MARK.f; }
  var PILL = { strong: "Strong match", possible: "Possible match", info: "Needs one more answer" };

  var openAll = false, openIds = {};
  function card(s, ev) {
    var crit = ev.rs.map(function (r) {
      var m = markFor(r.v);
      return '<li><span class="mark ' + m[0] + '" aria-hidden="true">' + m[1] + '</span><span class="sr">' + m[2] + ": </span><span>" + r.l + (r.v === null && r.need ? " (add your " + r.need + ")" : "") + "</span></li>";
    }).join("");
    var verify = s.verify.length || s.list ? '<div class="confirm"><b>Confirm when you apply</b><ul>' +
      (s.list ? "<li>Selection depends on official lists or records, so a match here is not a guarantee.</li>" : "") +
      s.verify.map(function (v) { return "<li>" + v + "</li>"; }).join("") + "</ul></div>" : "";
    var docs = s.docs.map(function (d) { return "<li>" + D[d] + "</li>"; }).join("");
    var ok = ev.rs.filter(function (r) { return r.v === true || r.v === "maybe"; }).length;
    var needs = [];
    ev.rs.forEach(function (r) { if (r.v === null) { var k = r.need || "details"; if (needs.indexOf(k) < 0) needs.push(k); } });
    var need = ev.status === "info" ? '<p class="need"><b>To check this, add:</b> ' + needs.join(", ") + "</p>" : "";
    var open = (openAll || openIds[s.id]) ? " open" : "";
    var label = ev.status === "info" ? "Criteria and documents" : "Why this matches and what to bring";
    return '<article class="card"><div class="card-top"><span class="pill ' + ev.status + '">' + PILL[ev.status] + '</span><span class="tag">' + (s.state ? STATES[s.state] + " · " : "") + CATS[s.cat] + "</span></div>" +
      "<div><h3>" + s.name + '</h3><p class="ministry">' + s.min + "</p></div>" +
      '<p class="benefit">' + s.benefit + "</p>" + (s.note ? '<p class="status-note"><b>Status.</b> ' + s.note + "</p>" : "") + need +
      '<details class="more" data-id="' + s.id + '"' + open + "><summary>" + label + ' <span class="muted">· ' + ok + " of " + ev.rs.length + ' criteria</span></summary><div class="more-body"><ul class="crit">' + crit + "</ul>" + verify +
      '<div><b>Keep ready</b><ul class="doclist" style="margin-top:6px">' + docs + "</ul></div><p>" + s.how + "</p></div></details>" +
      '<div class="card-foot"><a class="btn apply" href="' + s.url + '" target="_blank" rel="noopener">' + (s.urlLabel || "Open official portal") + ' <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a></div></article>';
  }

  function visible(s) {
    if (filterCat === "state") { if (!s.state) return false; } else if (filterCat !== "all" && s.cat !== filterCat) return false;
    if (!query) return true;
    var hay = (s.name + " " + s.benefit + " " + CATS[s.cat] + " " + s.min).toLowerCase();
    return query.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
  }

  var lastMatches = [];
  function render() {
    var p = derive(state);
    var pool = S.filter(function (s) { return !s.state || s.state === state.state; });
    var all = pool.map(function (s) { return { s: s, ev: evaluate(s, p) }; });
    var by = { strong: [], possible: [], info: [], no: [] };
    all.forEach(function (x) { by[x.ev.status].push(x); });
    lastMatches = by.strong.concat(by.possible);
    $("live").textContent = by.strong.length + " strong, " + by.possible.length + " possible and " + by.info.length + " need another answer.";
    $("jumpText").textContent = lastMatches.length + (lastMatches.length === 1 ? " match" : " matches");
    var core = [state.state, state.age, state.gender, state.area, state.income, state.cat, state.occ.length ? "y" : ""].filter(Boolean).length;
    $("meterFill").style.width = Math.round(core / 7 * 100) + "%";
    $("meterText").textContent = core + " of 7 key answers";

    $("counts").innerHTML =
      '<span class="count strong"><b>' + by.strong.length + "</b> strong</span>" +
      '<span class="count possible"><b>' + by.possible.length + "</b> possible</span>" +
      '<span class="count info"><b>' + by.info.length + "</b> need an answer</span>";

    var live = all.filter(function (x) { return x.ev.status !== "no"; });
    var cats = ["all"].concat(Object.keys(CATS));
    $("filters").innerHTML = cats.map(function (c) {
      var n = c === "all" ? live.length : live.filter(function (x) { return c === "state" ? !!x.s.state : x.s.cat === c; }).length;
      if (c !== "all" && n === 0) return "";
      return '<button type="button" data-cat="' + c + '" aria-pressed="' + (filterCat === c) + '">' + (c === "all" ? "All" : CATS[c]) + " " + n + "</button>";
    }).join("");

    var html = "";
    var groups = [
      ["strong", "Strong matches", "You meet every published criterion we can check."],
      ["possible", "Possible matches", "You meet the criteria, but the final decision depends on official lists, records or state rules."],
      ["info", "Need one more answer", "Add the missing detail in the form to see if these apply."]
    ];
    groups.forEach(function (g) {
      var items = by[g[0]].filter(function (x) { return visible(x.s); });
      if (!items.length) return;
      html += '<section class="group"><div class="group-head"><h2>' + g[1] + " (" + items.length + ")</h2><p>" + g[2] + "</p></div>" + items.map(function (x) { return card(x.s, x.ev); }).join("") + "</section>";
    });

    if (!html) html = '<div class="empty">No schemes to show here yet. Add your details on the left, or clear the search and filters.</div>';

    // documents kit
    var tally = {};
    lastMatches.forEach(function (x) { x.s.docs.forEach(function (d) { tally[d] = (tally[d] || 0) + 1; }); });
    var kit = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).slice(0, 8);
    if (kit.length) {
      html = '<section class="kit"><h2>Documents to keep ready</h2><p>Most used across your strong and possible matches.</p><ul class="doclist kitlist">' +
        kit.map(function (d) { return "<li>" + D[d] + "<b>" + tally[d] + "</b></li>"; }).join("") + "</ul></section>" + html;
    }

    var no = by.no.filter(function (x) { return visible(x.s); });
    if (no.length) {
      html += '<details class="nomatch"><summary><b>Not a match for your profile (' + no.length + ")</b></summary><ul>" +
        no.map(function (x) { return "<li>" + x.s.name + " <span>· needs: " + x.ev.fail.l.charAt(0).toLowerCase() + x.ev.fail.l.slice(1) + "</span></li>"; }).join("") + "</ul></details>";
    }
    var banner = "";
    if (!state.state) banner = "Choose your state to also see state schemes. Karnataka, Maharashtra, Tamil Nadu and Uttar Pradesh are included.";
    else if (state.state === "other") banner = "State schemes are not included for your state yet. Showing central schemes only. Search myScheme.gov.in for state schemes.";
    $("results").innerHTML = (banner ? '<p class="state-banner">' + banner + "</p>" : "") + html;
  }

  /* ---------- chat flow ---------- */
  var INC = [["1", "Up to ₹1 lakh"], ["1.5", "₹1 – 1.5 lakh"], ["2", "₹1.5 – 2 lakh"], ["2.5", "₹2 – 2.5 lakh"], ["3", "₹2.5 – 3 lakh"], ["4.5", "₹3 – 4.5 lakh"], ["6", "₹4.5 – 6 lakh"], ["8", "₹6 – 8 lakh"], ["9", "₹8 – 9 lakh"], ["99", "Above ₹9 lakh"]];
  var SHORT = { state: "State", age: "Age", gender: "Gender", area: "Area", income: "Income", cat: "Category", minority: "Minority", occ: "Work", land: "Land", edu: "Studying", disab: "Disability", flags: "Situation" };
  function simple(k, q, opts, extra) {
    var s = { k: k, q: q, t: "choice", opts: opts, get: function () { return state[k]; }, set: function (v) { state[k] = v; } };
    for (var x in (extra || {})) s[x] = extra[x];
    return s;
  }
  var STEPS = [
    simple("state", "Which state or union territory do you live in?", [["KA", "Karnataka"], ["MH", "Maharashtra"], ["TN", "Tamil Nadu"], ["UP", "Uttar Pradesh"], ["other", "Somewhere else"]]),
    { k: "age", q: "How old are you?", t: "number", get: function () { return state.age; }, set: function (v) { state.age = v; } },
    simple("gender", "What is your gender?", [["female", "Woman"], ["male", "Man"], ["other", "Other"]]),
    simple("area", "Do you live in a village or a town?", [["rural", "Village"], ["urban", "Town or city"]]),
    simple("income", "Roughly how much does your household earn in a year?", INC),
    simple("cat", "Which social category do you belong to?", [["general", "General"], ["obc", "OBC"], ["sc", "SC"], ["st", "ST"], ["", "Prefer not to say"]]),
    { k: "minority", q: "Do you belong to a notified minority (Muslim, Christian, Sikh, Buddhist, Jain or Parsi)?", t: "choice", opts: [["yes", "Yes"], ["no", "No"]],
      get: function () { return state.minority ? "yes" : "no"; }, set: function (v) { state.minority = v === "yes"; } },
    { k: "occ", q: "What do you do? Pick all that apply.", t: "multi", opts: OCC, get: function () { return state.occ.slice(); }, set: function (v) { state.occ = v; } },
    simple("land", "How much farm land do you own?", [["small", "Up to 2 hectares"], ["large", "More than 2 hectares"]], { show: function () { return state.occ.indexOf("farmer") > -1; }, needs: function () { return state.land === "na"; } }),
    simple("edu", "What are you studying?", [["school9_10", "Class 9 – 10"], ["school11_12", "Class 11 – 12"], ["ug", "Diploma or graduation"], ["pg", "Post-graduation"]], { show: function () { return state.occ.indexOf("student") > -1; }, needs: function () { return state.edu === "none"; } }),
    simple("disab", "Do you have a certified disability?", [["none", "No"], ["40", "Yes, 40% to 79%"], ["80", "Yes, 80% or more"]]),
    { k: "flags", q: "Which of these apply to you or your family? Pick all that apply.", t: "multi", opts: FLAGS,
      get: function () { return FLAGS.filter(function (f) { return state.flags[f[0]]; }).map(function (f) { return f[0]; }); },
      set: function (v) { FLAGS.forEach(function (f) { state.flags[f[0]] = v.indexOf(f[0]) > -1; }); } }
  ];
  function vsteps() { return STEPS.filter(function (s) { return !s.show || s.show(); }); }
  var chatIdx = (state.example || state.age !== "" || state.occ.length > 0) ? vsteps().length : 0;
  var mobileQ = window.matchMedia("(max-width: 920px)");
  var mode = mobileQ.matches ? "chat" : "form";

  function ansLabel(s) {
    var v = s.get();
    if (s.t === "number") return v === "" ? "Skipped" : v + " years old";
    if (s.t === "multi") {
      if (!v.length) return "None of these";
      return v.map(function (x) { var o = s.opts.filter(function (o) { return o[0] === x; })[0]; return o ? o[1] : x; }).join(", ");
    }
    var o = s.opts.filter(function (o) { return o[0] === v; })[0];
    return o ? o[1] : "Skipped";
  }
  var jumpBack = false, resume = 0, resumeDone = false, mainVisible = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function firstUnanswered(vs) { for (var i = 0; i < vs.length; i++) if (vs[i].needs && vs[i].needs()) return i; return -1; }
  function updateJump() { $("jump").hidden = !(mode === "form" && mobileQ.matches && !mainVisible); }
  function syncMain() { $("main").hidden = mode === "chat" && mobileQ.matches && chatIdx < vsteps().length; updateJump(); }
  function scrollToResults() { $("main").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" }); }
  function controls(s) {
    var cur = s.get(), h = "";
    if (s.t === "choice") {
      h = '<div class="opts">' + s.opts.map(function (o) { return '<button type="button" class="opt" data-pick="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>";
    } else if (s.t === "number") {
      h = '<div class="numrow"><input id="chatNum" type="number" inputmode="numeric" min="0" max="110" placeholder="e.g. 34" value="' + cur + '" aria-label="Your age" data-focus><button type="button" class="btn" data-send>Send</button></div>';
    } else {
      h = '<div class="chips">' + s.opts.map(function (o) { return '<label class="chip"><input type="checkbox" data-m="' + o[0] + '"' + (cur.indexOf(o[0]) > -1 ? " checked" : "") + "><span>" + o[1] + "</span></label>"; }).join("") + '</div><div><button type="button" class="btn" data-multi-done>Continue</button></div>';
    }
    return h + '<div class="navrow">' + (chatIdx > 0 && !jumpBack ? '<button type="button" class="btn-ghost" data-back>Back</button>' : "") + '<button type="button" class="btn-ghost" data-skip>' + (jumpBack ? "Cancel" : "Skip") + "</button></div>";
  }
  function chipRow(vs, upTo) {
    return '<div class="opts">' + vs.slice(0, upTo).map(function (s, i) { return '<button type="button" class="opt small" data-edit="' + i + '"><span>' + SHORT[s.k] + "</span>" + ansLabel(s) + "</button>"; }).join("") + "</div>";
  }
  function renderChat(user) {
    var vs = vsteps(), n = vs.length, h = "", done = chatIdx >= n;
    if (done) {
      var c = lastMatches.length;
      h += '<div class="b-q" tabindex="-1">That is everything I need. <b>' + c + (c === 1 ? " scheme matches" : " schemes match") + "</b> you so far. See the list " + (mobileQ.matches ? "below" : "on the right") + ". Open the list below to change an answer.</div>" + '<details class="review"' + (mobileQ.matches ? "" : " open") + "><summary>Review or change your answers</summary>" + chipRow(vs, n) + "</details>";
    } else {
      h += '<div class="progress"><div class="meter"><i style="width:' + Math.round(chatIdx / n * 100) + '%"></i></div><span>Question ' + (chatIdx + 1) + " of " + n + "</span></div>";
      h += '<div class="b-q" tabindex="-1">' + vs[chatIdx].q + '</div><div class="ctl">' + controls(vs[chatIdx]) + "</div>";
      if (chatIdx > 0) h += '<div class="sofar"><span class="sofar-l">Your answers so far</span>' + chipRow(vs, chatIdx) + "</div>";
    }
    $("chat").innerHTML = '<div class="panel-head"><h2>Your details</h2>' + (done ? '<button type="button" class="btn-ghost" data-restart>Start over</button>' : "") + "</div>" + h;
    syncMain();
    if (user) { var f = $("chat").querySelector("[data-focus]") || $("chat").querySelector(".b-q"); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "nearest" }); } }
  }
  function answered() { state.example = false; $("exampleNote").hidden = true; save(); writeForm(); render(); }
  function next(skipped) {
    var vs = vsteps();
    if (jumpBack) {
      var u = skipped ? -1 : firstUnanswered(vs);
      if (u > -1) chatIdx = u; else { jumpBack = false; chatIdx = resumeDone ? vs.length : Math.min(resume, vs.length); }
    } else chatIdx++;
    renderChat(true);
    if (chatIdx >= vsteps().length && mobileQ.matches) scrollToResults();
  }
  $("chat").addEventListener("click", function (e) {
    var t = e.target, b, s = vsteps()[chatIdx];
    if ((b = t.closest("[data-pick]")) && s) { s.set(b.getAttribute("data-pick")); answered(); next(false); return; }
    if (t.closest("[data-send]") && s) { var v = $("chatNum").value.trim(); if (v !== "") { s.set(String(Math.max(0, Math.min(110, Number(v))))); answered(); next(false); } else next(true); return; }
    if (t.closest("[data-multi-done]") && s) {
      s.set([].slice.call($("chat").querySelectorAll("[data-m]")).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute("data-m"); }));
      answered(); next(false); return;
    }
    if (t.closest("[data-skip]")) { next(true); return; }
    if (t.closest("[data-back]")) { chatIdx = Math.max(0, chatIdx - 1); renderChat(true); return; }
    if ((b = t.closest("[data-edit]"))) {
      if (!jumpBack) { resume = chatIdx; resumeDone = chatIdx >= vsteps().length; jumpBack = true; }
      chatIdx = Number(b.getAttribute("data-edit")); renderChat(true); return;
    }
    if (t.closest("[data-restart]")) { state = blank(); save(); writeForm(); render(); jumpBack = false; chatIdx = 0; renderChat(true); }
  });
  $("chat").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "chatNum") { e.preventDefault(); var btn = $("chat").querySelector("[data-send]"); if (btn) btn.click(); }
  });
  function setMode(m) {
    mode = m;
    $("panel").hidden = m !== "form"; $("chat").hidden = m !== "chat";
    document.querySelectorAll(".mode [data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === m)); });
    if (m === "chat") renderChat(false); else { writeForm(); syncMain(); }
  }
  document.querySelector(".mode").addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (b) setMode(b.getAttribute("data-mode")); });

  /* ---------- events ---------- */
  buildForm(); writeForm(); render(); setMode(mode);
  $("meta").textContent = S.length + " schemes · rules reviewed 22 Nov 2026 · Your answers stay on this device";
  $("results").addEventListener("toggle", function (e) { var d = e.target; if (d.classList && d.classList.contains("more")) openIds[d.getAttribute("data-id")] = d.open; }, true);
  $("toggleAll").addEventListener("click", function () { openAll = !openAll; if (!openAll) openIds = {}; $("toggleAll").textContent = openAll ? "Hide details" : "Show all details"; render(); });
  $("jumpBtn").addEventListener("click", scrollToResults);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { mainVisible = en[0].isIntersecting; updateJump(); }).observe($("main"));
  mobileQ.addEventListener("change", function () { if (mode === "chat") renderChat(false); syncMain(); });

  $("panel").addEventListener("input", function () { readForm(); save(); render(); });
  $("panel").addEventListener("change", function () { readForm(); save(); render(); });
  $("reset").addEventListener("click", function () { state = blank(); chatIdx = 0; save(); writeForm(); render(); $("age").focus(); });
  $("q").addEventListener("input", function (e) { query = e.target.value.trim(); render(); });
  $("filters").addEventListener("click", function (e) { var b = e.target.closest("button[data-cat]"); if (!b) return; filterCat = b.getAttribute("data-cat"); render(); });
  $("copy").addEventListener("click", function () {
    var text = "Schemes that match my profile\n\n" + (lastMatches.length ? lastMatches.map(function (x) { return "• " + x.s.name + " (" + PILL[x.ev.status] + ") – " + x.s.url; }).join("\n") : "None yet") +
      "\n\nConfirm each scheme on its official portal before applying.";
    var btn = $("copy");
    function done(msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = "Copy my list"; }, 1800); }
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); done(ok ? "Copied" : "Copy not allowed here");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback); else fallback();
  });
})();
