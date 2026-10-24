/*
  Site content. Edit this file to change any text on the site.
  Both the room (3D) page and the plain page read from it.

  Rules of thumb:
  - Keep `repo` null for private repositories (no link is rendered).
  - `placeholder: true` marks items still to be filled in; the site shows them
    with a "TBD" badge so visitors know they are not final.
  - Never put phone, email, address, card or bank data in here.
*/
window.SITE = {
  name: "Hezki",
  fullName: "Yehezkiel Efraim Darmadi",
  handle: "yehezkieled",
  title: "Hezki · Pocket Room",
  tagline: "Data engineer in Melbourne. I build data pipelines, agents and games.",
  intro:
    "3+ years across analytics, machine learning and pipeline automation. " +
    "This page is my room: click the PC, the TV or the badge case.",

  about: {
    heading: "Player profile",
    placeholder: false,
    location: "Melbourne, Australia",
    paragraphs: [
      "Hi, I'm Yehezkiel Efraim Darmadi, known as Hezki. I'm a data engineer " +
        "based in Melbourne, Australia, with 3+ years across analytics, " +
        "machine learning and pipeline automation.",
      "Evenings go to side projects: a browser fighting game, a personal " +
        "finance app, and tooling that lets a crew of coding agents ship work " +
        "on their own.",
    ],
    tags: ["data engineering", "machine learning", "agents", "games"],
  },

  skills: {
    heading: "Skills",
    groups: [
      { label: "Languages", items: ["Python", "SQL", "R"] },
      { label: "Data", items: ["ETL/ELT", "PostgreSQL", "pgvector", "ArangoDB", "Oracle"] },
      { label: "ML", items: ["Machine learning", "Deep learning", "Computer vision", "LLM agent orchestration"] },
      { label: "Platform", items: ["AWS (Certified Cloud Practitioner)", "OpenStack", "Docker", "GitHub Actions", "GitLab CI"] },
      { label: "BI", items: ["Tableau", "Power BI", "Metabase"] },
      { label: "Tools", items: ["Claude Code"] },
    ],
    certs: [
      "AWS Certified Cloud Practitioner",
      "Alteryx Designer Core",
      "IBM AI/Python",
      "DeepLearning.AI NLP",
      "IFoA CT2/CT3/CT7",
    ],
  },

  work: {
    heading: "Career mode",
    placeholder: false,
    roles: [
      {
        company: "EnergyOn",
        role: "Data Analyst",
        period: "Jul 2025 – present",
        place: "Notting Hill, AU",
        summary:
          "Utility, metering and billing for multi-tenant buildings. Automated " +
          "KPI and financial reporting (Excel VBA, Power Query), saving up to " +
          "15 person-days; reconciled utility, metering and billing data; " +
          "consumption and billing trend analysis.",
      },
      {
        company: "AiLECS Lab (Monash University x Australian Federal Police)",
        role: "Research Assistant",
        period: "Aug 2024 – Nov 2025",
        place: "",
        summary:
          "ArangoDB graph database on OpenStack (ARDC Nectar) for criminal " +
          "network data; Python query API; deep learning for video deepfake " +
          "detection; social network analysis and multi-objective genetic " +
          "algorithms (peer-reviewed publication).",
      },
      {
        company: "Teman Data",
        role: "Data Analyst",
        period: "Jun 2023 – Aug 2023",
        place: "Jakarta",
        summary:
          "SQL/PostgreSQL financial reporting; Metabase dashboards that won a " +
          "competitive tender.",
      },
      {
        company: "Matahari Group",
        role: "Data Scientist",
        period: "Dec 2022 – Mar 2023",
        place: "Jakarta",
        summary:
          "Alteryx ETL (50% faster processing); customer retention ML (+30% " +
          "risk assessment accuracy).",
      },
      {
        company: "Syngenta Foundation / YASI",
        role: "Senior Product Development Actuary",
        period: "Sep 2021 – Oct 2022",
        place: "Jakarta",
        summary:
          "Satellite weather data (CHIRPS, GSMaP, ERA5) in Python/R; 2 weather " +
          "index insurance products; VBA profit simulations; worked with AXA " +
          "Climate and Mandiri AXA.",
      },
      {
        company: "Lazada",
        role: "Business Analyst",
        period: "May 2021 – Aug 2021",
        place: "Jakarta",
        summary:
          "Seller performance analysis; 56% conversion in the first mega " +
          "campaign (top 5 among newcomers).",
      },
    ],
  },

  education: {
    heading: "Education",
    items: [
      {
        school: "Monash University",
        degree: "Master of Data Science, with Distinction",
        period: "2023 – 2025",
      },
      {
        school: "Asia Pacific University, Kuala Lumpur",
        degree: "Bachelor of Actuarial Science, First-Class Honours",
        period: "2017 – 2020",
      },
    ],
  },

  publications: {
    heading: "Publications",
    items: [
      {
        title: "Efficient Disruption of Criminal Networks through Multi-Objective Genetic Algorithms",
        year: "2025",
        url: null,
      },
      {
        title:
          "Comparison of Resampling Data and Without Resampling Data in Predicting the " +
          "Default Rate Using Logistic Regression: P2P lending in the US",
        year: "2017",
        url: null,
      },
    ],
  },

  projects: {
    heading: "Roster",
    items: [
      {
        id: "rumble-arena",
        name: "Rumble Arena",
        blurb:
          "Fan recreation of Digimon Rumble Arena 1 & 2, plus Pokémon. " +
          "Runs in the browser and on iPad, with a desktop build.",
        tags: ["game", "javascript", "browser", "ipad", "desktop"],
        status: "in progress",
        repo: null,
        icon: "pad",
      },
      {
        id: "broke-no-more",
        name: "broke-no-more",
        blurb:
          "Personal finance app with an AI money coach. " +
          "Never touches real money data.",
        tags: ["app", "typescript", "ai"],
        status: "in progress",
        repo: null,
        icon: "coin",
      },
      {
        id: "pm-plugin",
        name: "pm-plugin",
        blurb:
          "Claude Code plugin for markdown project management, " +
          "with the ICM folder structure.",
        tags: ["plugin", "claude code", "markdown"],
        status: "public",
        repo: "https://github.com/yehezkieled/pm-plugin",
        icon: "board",
      },
      {
        id: "hive",
        name: "hive",
        blurb:
          "Open-source multi-agent AI orchestration platform: async Python " +
          "orchestrator, 16k lines, PostgreSQL schema with 33 migrations + " +
          "pgvector, Docker Compose, GitHub Actions with 880+ pytest cases, " +
          "LLM token/cost tracking.",
        tags: ["agents", "python", "postgresql"],
        status: "public",
        repo: "https://github.com/yehezkieled/hive",
        icon: "hex",
      },
      {
        id: "firstmate",
        name: "firstmate",
        blurb: "Talk to one agent. Ship with a crew.",
        tags: ["agents", "shell"],
        status: "public",
        repo: "https://github.com/yehezkieled/firstmate",
        icon: "boat",
      },
      {
        id: "ai-digest",
        name: "ai-digest",
        blurb: "Daily AI research digest, delivered to Telegram.",
        tags: ["automation", "shell"],
        status: "public",
        repo: "https://github.com/yehezkieled/ai-digest",
        icon: "mail",
      },
      {
        id: "network-tariffs",
        name: "network tariff tables",
        blurb:
          "Every Australian electricity network tariff since 2017, " +
          "reconciled against each distributor's published prices.",
        tags: ["data", "python", "energy"],
        status: "public",
        repo: "https://github.com/yehezkieled/standardise_network_tariff_tables",
        icon: "bars",
      },
    ],
  },

  posts: {
    heading: "Log",
    placeholder: true,
    items: [
      {
        title: "First post goes here",
        date: "soon",
        url: null,
        blurb: "Placeholder. Posts will be listed here once I write them.",
      },
    ],
  },

  online: {
    heading: "Link cable",
    placeholder: false,
    links: [
      { label: "GitHub", url: "https://github.com/yehezkieled", note: "code" },
      { label: "LinkedIn", url: "https://linkedin.com/in/yehezkieled", note: "work" },
    ],
  },
};
