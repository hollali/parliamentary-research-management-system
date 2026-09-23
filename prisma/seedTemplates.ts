import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const builtInTemplates = [
  {
    id: "builtin-legislation",
    name: "Legislative Brief",
    description: "Comprehensive briefing template for proposed or enacted legislation, covering legal context, stakeholder impact, fiscal implications, and actionable recommendations for Parliament.",
    category: "Legislation",
    sections: [
      { heading: "Purpose & Scope", prompt: "State the purpose of this brief. What legislation is being examined, who requested the analysis, and what specific questions should the reader keep in mind?" },
      { heading: "Legislative History", prompt: "Trace the bill's journey: when it was first introduced, by whom (private member or government), which committee has carriage, what stage it has reached (first reading, committee stage, report stage, third reading), and any significant amendments along the way." },
      { heading: "Existing Legal Framework", prompt: "Describe the current laws, statutes, and regulations that the bill seeks to amend, repeal, or supplement. Identify any gaps or contradictions in the existing framework that the bill aims to address." },
      { heading: "Summary of Key Provisions", prompt: "Provide a clause-by-clause or section-by-section summary of the bill's main provisions. For each provision, state what it changes, who it affects, and what the practical on-the-ground impact would be." },
      { heading: "Comparative & Regional Analysis", prompt: "How do similar laws work in other ECOWAS member states, Commonwealth countries, or comparable jurisdictions? What best practices or cautionary lessons can Ghana draw from their experience?" },
      { heading: "Constitutional & Human Rights Review", prompt: "Assess alignment with the 1992 Constitution, particularly relevant articles (e.g. fundamental rights, directive principles of state policy). Flag any provisions that may be vulnerable to constitutional challenge or that require a constitutional amendment." },
      { heading: "Stakeholder Impact Assessment", prompt: "Identify all affected parties: government agencies, local authorities, private sector, civil society organisations, traditional authorities, and ordinary citizens. For each group, assess the expected benefits, burdens, and any transition challenges." },
      { heading: "Public Participation & Consultation Summary", prompt: "Summarise the public consultations conducted (town halls, written memoranda, stakeholder forums). What were the main themes of support and opposition? Were any significant concerns raised that the bill does not address?" },
      { heading: "Fiscal & Economic Impact", prompt: "Estimate the direct and indirect costs of implementation: new personnel, infrastructure, technology, training. Identify funding sources (consolidated fund, levies, donor support). Assess the expected economic impact on affected sectors and the national budget." },
      { heading: "Regulatory Impact Assessment", prompt: "What new regulations, subsidiary legislation, or administrative orders will be required to implement the bill? Estimate the compliance burden on businesses and citizens. Identify any overlap or conflict with existing regulatory bodies." },
      { heading: "Implementation Roadmap", prompt: "Propose a realistic implementation timeline: what can be enacted immediately, what requires transitional provisions, and what depends on secondary legislation or institutional capacity building? Identify the responsible agencies for each phase." },
      { heading: "Sunset & Review Provisions", prompt: "Does the bill include sunset clauses or mandatory review periods? If not, should it? Recommend appropriate review timelines and the criteria that should trigger an early review of the legislation." },
      { heading: "Risk & Unintended Consequences", prompt: "Identify the main risks of enacting (or not enacting) this bill. Consider enforcement challenges, potential for misuse, impact on existing rights, and any unintended consequences that proponents may not have anticipated." },
      { heading: "Recommendations", prompt: "Provide 5-7 specific, actionable recommendations for the Committee or Plenary. Each recommendation should state: (a) what action is recommended, (b) who is responsible, (c) the expected timeline, and (d) the priority level (urgent, important, or routine)." },
    ],
  },
  {
    id: "builtin-policy",
    name: "Policy Brief",
    description: "Analytical brief addressing a specific policy question, suitable for committee deliberation or ministerial consideration.",
    category: "Policy",
    sections: [
      { heading: "Policy Issue Summary", prompt: "State the policy problem clearly in 2-3 sentences. What is the question Parliament needs to answer?" },
      { heading: "Current Policy Landscape", prompt: "Describe the existing policies, programmes, and institutional arrangements related to this issue." },
      { heading: "Data & Evidence", prompt: "Present the key statistics, research findings, and data that inform this policy area. Cite credible sources." },
      { heading: "Policy Options", prompt: "Outline 2-3 policy options (including the status quo). For each, describe the approach, feasibility, and trade-offs." },
      { heading: "Stakeholder Perspectives", prompt: "Summarise the positions of key stakeholders (ministries, CSOs, private sector, affected communities) on each option." },
      { heading: "Risk Assessment", prompt: "For each policy option, identify the main risks, implementation challenges, and unintended consequences." },
      { heading: "Recommendation & Next Steps", prompt: "Recommend the preferred option with justification. Outline implementation steps and a monitoring framework." },
    ],
  },
  {
    id: "builtin-committee",
    name: "Committee Report",
    description: "Structured report template for research requests, investigations, or oversight activities.",
    category: "Committee",
    sections: [
      { heading: "Committee Mandate", prompt: "State the committee's terms of reference for this request. What was the scope and timeline?" },
      { heading: "Methodology", prompt: "Describe how the committee gathered evidence: hearings, site visits, written submissions, expert consultations." },
      { heading: "Background & Context", prompt: "Provide the broader context for the request. Why was it initiated? What triggered the investigation?" },
      { heading: "Key Findings", prompt: "Present the main findings organised by theme. Each finding should be supported by evidence cited in hearings or submissions." },
      { heading: "Analysis & Discussion", prompt: "Interpret the findings. What patterns emerge? How do they compare to expectations or previous reports?" },
      { heading: "Government Response Summary", prompt: "Summarise any official responses received from ministries, agencies, or other bodies in response to the request." },
      { heading: "Recommendations", prompt: "List specific, actionable recommendations directed at responsible entities. Include target dates and responsible parties." },
      { heading: "Dissenting Views", prompt: "Record any minority opinions or dissenting views expressed by committee members, if applicable." },
    ],
  },
  {
    id: "builtin-research",
    name: "Research Summary",
    description: "Condensed research output summarising findings from a detailed investigation or data analysis.",
    category: "Research",
    sections: [
      { heading: "Research Objective", prompt: "State the research question or objective. What gap in knowledge or practice was this research intended to address?" },
      { heading: "Methodology", prompt: "Briefly describe the research methods: literature review, surveys, interviews, data analysis, case studies." },
      { heading: "Key Findings", prompt: "Present the 3-5 most important findings. Use clear, non-technical language suitable for parliamentary audience." },
      { heading: "Data Highlights", prompt: "Include 2-3 key statistics, charts, or data points that best illustrate the findings." },
      { heading: "Implications for Parliament", prompt: "What do these findings mean for legislative or policy action? How should Parliament respond?" },
      { heading: "Limitations", prompt: "Acknowledge any limitations in the research scope, data quality, or methodology that readers should consider." },
      { heading: "Conclusion & Recommendations", prompt: "Summarise the main takeaway and provide 2-3 prioritised recommendations for parliamentary action." },
    ],
  },
  {
    id: "builtin-proceedings",
    name: "Hansard Summary",
    description: "Template for summarising parliamentary proceedings, debates, and decisions from a specific sitting or session.",
    category: "Proceedings",
    sections: [
      { heading: "Sitting Details", prompt: "Date, time, session number, presiding officer, and quorum status." },
      { heading: "Order Paper Summary", prompt: "List the items on the order paper and indicate which were debated, deferred, or withdrawn." },
      { heading: "Key Debates & Arguments", prompt: "Summarise the main debates, including positions expressed by the majority and minority sides." },
      { heading: "Motions & Resolutions", prompt: "Record all motions moved, seconded, and the outcomes (carried, defeated, withdrawn)." },
      { heading: "Questions & Answers", prompt: "Summarise notable oral and written questions posed to ministers and the responses given." },
      { heading: "Votes & Divisions", prompt: "Record any recorded votes, the numbers on each side, and the final decision." },
      { heading: "Committee Reports Presented", prompt: "List any committee reports tabled during the sitting and their key recommendations." },
      { heading: "Next Sitting & Action Items", prompt: "Note the date of the next sitting and any action items or referrals resulting from this sitting." },
    ],
  },
];

async function main() {
  for (const tpl of builtInTemplates) {
    await prisma.template.upsert({
      where: { id: tpl.id },
      update: { name: tpl.name, description: tpl.description, sections: tpl.sections },
      create: tpl,
    });
    console.log("Seeded: " + tpl.name);
  }
  console.log("All built-in templates seeded");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
