import "dotenv/config";
import { PrismaClient, Role, Priority, RequestStatus, NotificationType, FileType, ActivityAction, CommitteeType } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Departments
  const departments = await Promise.all([
    prisma.department.create({ data: { name: "Research Division", description: "Parliamentary research services" } }),
    prisma.department.create({ data: { name: "Legislative Affairs", description: "Legislative analysis and policy research" } }),
    prisma.department.create({ data: { name: "Economic Analysis", description: "Economic policy and fiscal analysis" } }),
    prisma.department.create({ data: { name: "Social Affairs", description: "Social policy and welfare research" } }),
  ]);

  // Parliament of Ghana Standing Committees
  const committees = await Promise.all([
    prisma.committee.create({
      data: {
        name: "Appointments Committee",
        shortName: "APPT",
        description: "Vetting and approval of presidential nominees for ministerial and other key positions",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Speaker (ex-officio)",
        clerk: "Clerk to Parliament",
        jurisdiction: "Constitutional Article 78 - Vetting of Ministers of State",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Public Accounts Committee",
        shortName: "PAC",
        description: "Examination of public accounts and Auditor-General's reports",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. James Klutse Avedzi",
        clerk: "Senior Clerk, PAC",
        jurisdiction: "Article 187 - Public Accounts of Ghana",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Constitutional, Legal and Parliamentary Affairs",
        shortName: "CLP",
        description: "Constitutional amendments, legal reforms, and parliamentary standing orders",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Ben Abdul-Rashid Bawa",
        clerk: "Clerk, CLP",
        jurisdiction: "Article 108 - Constitutional and legal matters",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Education",
        shortName: "EDU",
        description: "Education policy, curriculum development, and educational institution oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Kwabena Okyere Darko-Mensah",
        clerk: "Clerk, Education Committee",
        jurisdiction: "Education Act 2008 (Act 778) - Education policy and oversight",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Health",
        shortName: "HLT",
        description: "Public health policy, healthcare delivery, and health institution oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Kwabena Mintah Akandoh",
        clerk: "Clerk, Health Committee",
        jurisdiction: "Health Act 2012 (Act 851) - Health policy and delivery",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Finance",
        shortName: "FIN",
        description: "National budget, fiscal policy, taxation, and economic planning oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Isaac Adongo",
        clerk: "Clerk, Finance Committee",
        jurisdiction: "Article 179 - Financial provisions and Appropriation Bill",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Defence and Interior",
        shortName: "DEF",
        description: "Defence, national security, interior affairs, and armed forces oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Peter Nortsu-Korto",
        clerk: "Clerk, Defence Committee",
        jurisdiction: "Article 210 - Ghana Armed Forces oversight",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Energy and Mines",
        shortName: "ENM",
        description: "Energy policy, petroleum, mining, and mineral resources oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. John Abdulai Jinapor",
        clerk: "Clerk, Energy Committee",
        jurisdiction: "Energy Commission Act 1997 (Act 541) - Energy and mining oversight",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Roads and Transport",
        shortName: "R&T",
        description: "Road infrastructure, public transport, and aviation oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Kennedy Osei Nyarko",
        clerk: "Clerk, Roads Committee",
        jurisdiction: "Roads Authority Act 2008 (Act 767) - Transport and infrastructure",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Gender and Children",
        shortName: "GEN",
        description: "Gender equality, women's rights, and child protection policy",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Jennifer Opoku-Adjeye",
        clerk: "Clerk, Gender Committee",
        jurisdiction: "Children Act 1998 (Act 560) - Gender and child welfare",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Local Government and Rural Development",
        shortName: "LGRD",
        description: "Decentralization, district assemblies, and rural development policy",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Emmanuel Armah-Kofi Buah",
        clerk: "Clerk, LGRD Committee",
        jurisdiction: "Local Governance Act 2016 (Act 936) - Decentralization and local governance",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Food and Agriculture",
        shortName: "F&A",
        description: "Agricultural policy, food security, and rural livelihoods oversight",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Johnson Ayisi Asiedu",
        clerk: "Clerk, Agriculture Committee",
        jurisdiction: "Plant Protection Act 2016 (Act 909) - Agriculture and food security",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Communications and Digitalisation",
        shortName: "COM",
        description: "Telecommunications, ICT policy, digital transformation, and postal services",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Habib Iddrisu",
        clerk: "Clerk, Communications Committee",
        jurisdiction: "National Communications Authority Act 1996 (Act 526) - ICT and digital policy",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Environment, Science and Technology",
        shortName: "EST",
        description: "Environmental protection, climate change, science research, and technology policy",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Zuwera Ibrahimah",
        clerk: "Clerk, Environment Committee",
        jurisdiction: "Environmental Assessment Regulations 1999 (LI 1652) - Environment and science",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Employment, Labour Relations and Pensions",
        shortName: "ELRP",
        description: "Employment policy, labour relations, workers' rights, and pension reform",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Isaac Adongo",
        clerk: "Clerk, ELRP Committee",
        jurisdiction: "Labour Act 2003 (Act 651) - Employment and labour relations",
      },
    }),
    prisma.committee.create({
      data: {
        name: "Committee on Trade, Industry and Tourism",
        shortName: "TIT",
        description: "Trade policy, industrial development, tourism, and export promotion",
        committeeType: CommitteeType.STANDING,
        chairperson: "Hon. Frank Annoh-Dompreh",
        clerk: "Clerk, Trade Committee",
        jurisdiction: "Ghana Investment Promotion Centre Act 1994 (Act 478) - Trade and industry",
      },
    }),
  ]);

  // Users
  const password = await bcrypt.hash("password123", 12);

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@parliament.gh",
      passwordHash: password,
      firstName: "Kwame",
      lastName: "Asante",
      role: Role.ADMIN,
      title: "Administrator",
      initials: "KA",
      departmentId: departments[0].id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "research.director@parliament.gh",
      passwordHash: password,
      firstName: "Ama",
      lastName: "Mensah",
      role: Role.ADMIN,
      title: "Director of Research",
      initials: "AM",
      departmentId: departments[0].id,
    },
  });

  const officers = await Promise.all([
    prisma.user.create({
      data: {
        email: "kofi.osei@parliament.gh",
        passwordHash: password,
        firstName: "Kofi",
        lastName: "Osei",
        role: Role.RESEARCH_OFFICER,
        title: "Senior Research Officer",
        initials: "KO",
        departmentId: departments[1].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "serwaa.appiah@parliament.gh",
        passwordHash: password,
        firstName: "Serwaa",
        lastName: "Appiah",
        role: Role.RESEARCH_OFFICER,
        title: "Research Officer",
        initials: "SA",
        departmentId: departments[2].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "gyasi.mensah@parliament.gh",
        passwordHash: password,
        firstName: "Gyasi",
        lastName: "Mensah",
        role: Role.RESEARCH_OFFICER,
        title: "Research Officer",
        initials: "GM",
        departmentId: departments[3].id,
      },
    }),
  ]);

  const assistants = await Promise.all([
    prisma.user.create({
      data: {
        email: "adwoa.boakye@parliament.gh",
        passwordHash: password,
        firstName: "Adwoa",
        lastName: "Boakye",
        role: Role.RESEARCH_ASSISTANT,
        title: "Research Assistant",
        initials: "AB",
        departmentId: departments[1].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "yaw.darko@parliament.gh",
        passwordHash: password,
        firstName: "Yaw",
        lastName: "Darko",
        role: Role.RESEARCH_ASSISTANT,
        title: "Research Assistant",
        initials: "YD",
        departmentId: departments[2].id,
      },
    }),
  ]);

  const mps = await Promise.all([
    prisma.user.create({
      data: {
        email: "hon.boateng@parliament.gh",
        passwordHash: password,
        firstName: "Emmanuel",
        lastName: "Boateng",
        role: Role.MP,
        title: "Honourable Member of Parliament",
        initials: "EB",
        departmentId: departments[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "hon.adjei@parliament.gh",
        passwordHash: password,
        firstName: "Abena",
        lastName: "Adjei",
        role: Role.MP,
        title: "Honourable Member of Parliament",
        initials: "AA",
        departmentId: departments[0].id,
      },
    }),
    prisma.user.create({
      data: {
        email: "hon.kumah@parliament.gh",
        passwordHash: password,
        firstName: "John",
        lastName: "Kumah",
        role: Role.MP,
        title: "Honourable Member of Parliament",
        initials: "JK",
        departmentId: departments[0].id,
      },
    }),
  ]);

  console.log("Users created");

  // Research Requests
  const requests = await Promise.all([
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0001",
        title: "Impact of Free SHS Policy on Rural Education Outcomes",
        subject: "Education Policy",
        description: "A comprehensive analysis of the Free Senior High School policy's impact on enrollment rates, completion rates, and educational quality in rural communities across Ghana.",
        scope: "National rural districts with focus on Northern, Upper East, and Upper West regions",
        keyStakeholders: "Ministry of Education, Ghana Education Service, PTA associations, School Management Committees",
        dataSources: "Ghana Statistical Service, MoE data, District Education Directorates",
        priority: Priority.URGENT,
        status: RequestStatus.ASSIGNED,
        deadline: new Date("2024-03-15"),
        submitterId: mps[0].id,
        assignedOfficerId: officers[0].id,
        categoryId: committees[7].id, // Energy and Mines
        draftVersion: 1,
        dateAssigned: new Date("2024-01-20"),
      },
    }),
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0002",
        title: "Ghana's Digital Infrastructure Bill: Comparative Analysis",
        subject: "Digital Policy",
        description: "Comparative analysis of Ghana's proposed Digital Infrastructure Bill against similar legislation in Kenya, Nigeria, and Rwanda.",
        scope: "Comparative legislative review across West and East Africa",
        keyStakeholders: "Ministry of Communications, NCA, Data Protection Commission",
        priority: Priority.STANDARD,
        status: RequestStatus.IN_PROGRESS,
        deadline: new Date("2024-04-01"),
        submitterId: mps[1].id,
        assignedOfficerId: officers[1].id,
        categoryId: committees[12].id, // Communications and Digitalisation
        draftVersion: 0,
        dateAssigned: new Date("2024-01-25"),
      },
    }),
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0003",
        title: "Fiscal Impact Assessment of Proposed Tax Reforms",
        subject: "Fiscal Policy",
        description: "Assessment of the projected fiscal impact of proposed corporate and income tax reforms on government revenue and economic growth.",
        scope: "National macroeconomic analysis with sectoral breakdown",
        keyStakeholders: "MoF, GRA, Bank of Ghana, economic think tanks",
        priority: Priority.URGENT,
        status: RequestStatus.DRAFT_SUBMITTED,
        deadline: new Date("2024-02-28"),
        submitterId: mps[2].id,
        assignedOfficerId: officers[1].id,
        categoryId: committees[5].id, // Finance
        draftVersion: 2,
        dateAssigned: new Date("2024-01-10"),
      },
    }),
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0004",
        title: "Community Health Insurance Scheme Review",
        subject: "Health Policy",
        description: "Review of the National Health Insurance Scheme coverage gaps and recommendations for expanding coverage to underserved populations.",
        scope: "National with regional case studies",
        priority: Priority.STANDARD,
        status: RequestStatus.SUBMITTED,
        deadline: new Date("2024-05-01"),
        submitterId: mps[0].id,
        categoryId: committees[4].id, // Health
      },
    }),
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0005",
        title: "Mineral Revenue Transparency and Accountability",
        subject: "Natural Resources",
        description: "Analysis of the effectiveness of the Minerals Development Fund and EITI reporting in ensuring transparency of mining revenue distribution.",
        scope: "Focus on mining communities in Ashanti, Western, and Eastern regions",
        keyStakeholders: "Minerals Commission, EPA, mining communities, civil society organizations",
        priority: Priority.URGENT,
        status: RequestStatus.REVISION_REQUESTED,
        deadline: new Date("2024-03-20"),
        submitterId: mps[2].id,
        assignedOfficerId: officers[2].id,
        categoryId: committees[13].id, // Environment, Science and Technology
        draftVersion: 1,
        dateAssigned: new Date("2024-01-15"),
      },
    }),
    prisma.researchRequest.create({
      data: {
        requestNumber: "REQ-2024-0006",
        title: "Constitutional Amendment Impact on Local Governance",
        subject: "Constitutional Matters",
        description: "Review of proposed constitutional amendments affecting local government autonomy and their implications for decentralized governance.",
        scope: "National constitutional and legal analysis",
        priority: Priority.STANDARD,
        status: RequestStatus.APPROVED,
        deadline: new Date("2024-02-01"),
        submitterId: mps[1].id,
        assignedOfficerId: officers[0].id,
        categoryId: committees[2].id, // Constitutional, Legal and Parliamentary Affairs
        draftVersion: 3,
        dateAssigned: new Date("2023-12-15"),
        dateCompleted: new Date("2024-01-30"),
      },
    }),
  ]);

  console.log("Research requests created");

  // Reports
  const reports = await Promise.all([
    prisma.researchReport.create({
      data: {
        requestId: requests[0].id,
        authorId: officers[0].id,
        title: "Free SHS Impact Assessment - Draft Report",
        content: "Executive Summary: This report examines the impact of the Free Senior High School policy on educational outcomes in rural Ghana...",
        isDraft: true,
        version: 1,
      },
    }),
    prisma.researchReport.create({
      data: {
        requestId: requests[2].id,
        authorId: officers[1].id,
        title: "Tax Reform Fiscal Impact Analysis - Version 2",
        content: "This analysis projects the macroeconomic impact of proposed tax reforms on government revenue streams and GDP growth...",
        isDraft: true,
        version: 2,
      },
    }),
    prisma.researchReport.create({
      data: {
        requestId: requests[5].id,
        authorId: officers[0].id,
        title: "Constitutional Amendment Impact - Final Report",
        content: "This report provides a comprehensive analysis of the proposed constitutional amendments affecting local governance structures...",
        isApproved: true,
        approvedAt: new Date("2024-01-30"),
        approvedById: admin.id,
        isDraft: false,
        version: 3,
      },
    }),
  ]);

  console.log("Reports created");

  // Review comments
  await prisma.reviewComment.createMany({
    data: [
      {
        reportId: reports[1].id,
        requestId: requests[2].id,
        authorId: admin.id,
        section: "Methodology",
        text: "The regression model needs to account for regional GDP variations. Consider using fixed effects.",
      },
      {
        reportId: reports[1].id,
        requestId: requests[2].id,
        authorId: admin.id,
        section: "Findings",
        text: "Please include sensitivity analysis for the projected revenue figures under different growth scenarios.",
      },
      {
        reportId: reports[0].id,
        requestId: requests[0].id,
        authorId: admin.id,
        section: "Data Sources",
        text: "Include the latest GSS census data for more accurate enrollment figures.",
      },
    ],
  });

  console.log("Review comments created");

  // Notifications
  await prisma.notification.createMany({
    data: [
      {
        recipientId: officers[0].id,
        type: NotificationType.REQUEST_ASSIGNED,
        title: "New Research Assignment",
        message: "You have been assigned: Impact of Free SHS Policy on Rural Education Outcomes",
      },
      {
        recipientId: officers[1].id,
        type: NotificationType.REPORT_UPLOADED,
        title: "Draft Report Submitted",
        message: "Version 2 of 'Tax Reform Fiscal Impact Analysis' has been uploaded",
      },
      {
        recipientId: mps[0].id,
        type: NotificationType.REPORT_APPROVED,
        title: "Report Approved",
        message: "Your research request 'Constitutional Amendment Impact' has been approved and is ready for delivery",
      },
      {
        recipientId: officers[2].id,
        type: NotificationType.REVISION_REQUESTED,
        title: "Revision Requested",
        message: "Revision requested for: Mineral Revenue Transparency and Accountability",
      },
    ],
  });

  console.log("Notifications created");

  // Activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        authorId: mps[0].id,
        action: ActivityAction.CREATED,
        entityType: "ResearchRequest",
        entityId: requests[0].id,
        description: "Research request 'Impact of Free SHS Policy' submitted",
      },
      {
        authorId: admin.id,
        action: ActivityAction.ASSIGNED,
        entityType: "ResearchRequest",
        entityId: requests[0].id,
        description: "Assigned to Kofi Osei",
      },
      {
        authorId: officers[0].id,
        action: ActivityAction.FILE_UPLOADED,
        entityType: "ResearchReport",
        entityId: reports[0].id,
        description: "Draft report uploaded for Free SHS Impact Assessment",
      },
      {
        authorId: admin.id,
        action: ActivityAction.APPROVED,
        entityType: "ResearchReport",
        entityId: reports[2].id,
        description: "Final report approved for REQ-2024-0006",
      },
    ],
  });

  console.log("Activity logs created");

  // Settings
  await prisma.setting.createMany({
    data: [
      { key: "system_name", value: "Parliamentary Research Request Management System" },
      { key: "institution", value: "Parliamentary Service of Ghana" },
      { key: "max_upload_size_mb", value: 50 },
      { key: "supported_file_types", value: ["PDF", "DOCX", "XLSX", "ZIP"] },
      { key: "default_deadline_days", value: 30 },
      { key: "notification_email_enabled", value: true },
    ],
  });

  console.log("Settings created");

  // Research Teams
  const teamLegislative = await prisma.researchTeam.create({
    data: {
      name: "Legislative Analysis Team",
      description: "Handles bills, motions, and legislative policy research",
      leadId: admin.id,
      members: {
        create: [
          { userId: officers[0].id },
          { userId: officers[1].id },
          { userId: assistants[0].id },
        ],
      },
    },
  });

  const teamEconomic = await prisma.researchTeam.create({
    data: {
      name: "Economic Policy Team",
      description: "Handles budget, fiscal policy, and economic impact research",
      leadId: admin.id,
      members: {
        create: [
          { userId: officers[1].id },
          { userId: officers[2].id },
          { userId: assistants[1].id },
        ],
      },
    },
  });

  const teamSocial = await prisma.researchTeam.create({
    data: {
      name: "Social Affairs Team",
      description: "Handles health, education, and social welfare research",
      leadId: admin.id,
      members: {
        create: [
          { userId: officers[2].id },
          { userId: assistants[0].id },
        ],
      },
    },
  });

  console.log("Teams created");

  console.log("Seeding complete!");
  console.log("\nTest credentials:");
  console.log("Super Admin: admin@parliament.gh / password123");
  console.log("Admin: research.director@parliament.gh / password123");
  console.log("Officer: kofi.osei@parliament.gh / password123");
  console.log("MP: hon.boateng@parliament.gh / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
