import { Member, Invoice, Ticket, Provider, BenefitPlan, User, DashboardMetrics, MonthlySpend, TopCondition, TopProvider, Claim } from './types';

export const mockMembers: Member[] = [
  {
    id: '1', employeeId: 'EMP001', firstName: 'Adaeze', lastName: 'Okonkwo',
    email: 'adaeze.okonkwo@dangote.com', phone: '08031234567',
    gender: 'Female', dateOfBirth: '1985-03-15', plan: 'Max Plan',
    type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2023-01-01', dependants: 3
  },
  {
    id: '2', employeeId: 'EMP002', firstName: 'Chukwuemeka', lastName: 'Eze',
    email: 'chukwuemeka.eze@dangote.com', phone: '08055678901',
    gender: 'Male', dateOfBirth: '1978-07-22', plan: 'Max Plan',
    type: 'Principal', status: 'Active', location: 'Abuja', enrollmentDate: '2023-01-01', dependants: 2
  },
  {
    id: '3', employeeId: 'EMP003', firstName: 'Fatima', lastName: 'Mohammed',
    email: 'fatima.mohammed@dangote.com', phone: '08067891234',
    gender: 'Female', dateOfBirth: '1990-11-08', plan: 'Pro Plan',
    type: 'Principal', status: 'Active', location: 'Kano', enrollmentDate: '2023-01-01', dependants: 1
  },
  {
    id: '4', employeeId: 'EMP004', firstName: 'Babatunde', lastName: 'Adeyemi',
    email: 'babatunde.adeyemi@dangote.com', phone: '08012345678',
    gender: 'Male', dateOfBirth: '1982-05-30', plan: 'Pro Plan',
    type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2023-02-15', dependants: 4
  },
  {
    id: '5', employeeId: 'EMP005', firstName: 'Ngozi', lastName: 'Ikenna',
    email: 'ngozi.ikenna@dangote.com', phone: '08098765432',
    gender: 'Female', dateOfBirth: '1995-09-12', plan: 'Plus Plan',
    type: 'Principal', status: 'Pending', location: 'Port Harcourt', enrollmentDate: '2026-06-01', dependants: 0
  },
  {
    id: '6', employeeId: 'EMP006', firstName: 'Segun', lastName: 'Afolabi',
    email: 'segun.afolabi@dangote.com', phone: '08023456789',
    gender: 'Male', dateOfBirth: '1988-12-03', plan: 'Plus Plan',
    type: 'Principal', status: 'Active', location: 'Ibadan', enrollmentDate: '2023-03-01', dependants: 2
  },
  {
    id: '7', employeeId: 'EMP007', firstName: 'Amina', lastName: 'Yusuf',
    email: 'amina.yusuf@dangote.com', phone: '08045678901',
    gender: 'Female', dateOfBirth: '1993-04-18', plan: 'Max Plan',
    type: 'Dependant', status: 'Active', location: 'Abuja', enrollmentDate: '2023-01-01'
  },
  {
    id: '8', employeeId: 'EMP008', firstName: 'Emeka', lastName: 'Obi',
    email: 'emeka.obi@dangote.com', phone: '08076543210',
    gender: 'Male', dateOfBirth: '1975-08-25', plan: 'Pro Plan',
    type: 'Principal', status: 'Terminated', location: 'Lagos', enrollmentDate: '2022-06-01', dependants: 1
  },
  {
    id: '9', employeeId: 'EMP009', firstName: 'Chioma', lastName: 'Nwosu',
    email: 'chioma.nwosu@dangote.com', phone: '08031112233',
    gender: 'Female', dateOfBirth: '1986-06-20', plan: 'Promax Plan',
    type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2023-04-01', dependants: 2
  },
  {
    id: '10', employeeId: 'EMP010', firstName: 'Kemi', lastName: 'Adeleke',
    email: 'kemi.adeleke@dangote.com', phone: '08044556677',
    gender: 'Female', dateOfBirth: '1980-02-14', plan: 'Promax Plan',
    type: 'Principal', status: 'Active', location: 'Abuja', enrollmentDate: '2023-04-01', dependants: 3
  },
  {
    id: '11', employeeId: 'EMP011', firstName: 'Tunde', lastName: 'Bakare',
    email: 'tunde.bakare@dangote.com', phone: '08088990011',
    gender: 'Male', dateOfBirth: '1970-09-05', plan: 'Magnum Plan',
    type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2022-01-01', dependants: 4
  },
  {
    id: '12', employeeId: 'EMP012', firstName: 'Yetunde', lastName: 'Adesanya',
    email: 'yetunde.adesanya@dangote.com', phone: '08022334455',
    gender: 'Female', dateOfBirth: '1983-11-30', plan: 'Magnum Plan',
    type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2022-01-01', dependants: 1
  },
  {
    id: '13', employeeId: 'EMP013', firstName: 'Obiora', lastName: 'Nnamdi',
    email: 'obiora.nnamdi@dangote.com', phone: '08066778899',
    gender: 'Male', dateOfBirth: '1991-07-18', plan: 'Pro Plan',
    type: 'Principal', status: 'Active', location: 'Port Harcourt', enrollmentDate: '2023-07-01', dependants: 0
  },
  {
    id: '14', employeeId: 'EMP014', firstName: 'Halima', lastName: 'Garba',
    email: 'halima.garba@dangote.com', phone: '08099001122',
    gender: 'Female', dateOfBirth: '1987-04-22', plan: 'Max Plan',
    type: 'Principal', status: 'Active', location: 'Kano', enrollmentDate: '2023-01-01', dependants: 2
  },
  {
    id: '15', employeeId: 'EMP015', firstName: 'Chidi', lastName: 'Okeke',
    email: 'chidi.okeke@dangote.com', phone: '08033445566',
    gender: 'Male', dateOfBirth: '1989-12-10', plan: 'Pro Plan',
    type: 'Principal', status: 'Active', location: 'Enugu', enrollmentDate: '2023-09-01', dependants: 1
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: '1', invoiceNo: 'INV-2026-001', date: '2026-01-01', dueDate: '2026-01-31',
    description: 'Monthly Health Premium - January 2026', amount: 10500000, status: 'Paid'
  },
  {
    id: '2', invoiceNo: 'INV-2026-002', date: '2026-02-01', dueDate: '2026-02-28',
    description: 'Monthly Health Premium - February 2026', amount: 10500000, status: 'Paid'
  },
  {
    id: '3', invoiceNo: 'INV-2026-003', date: '2026-03-01', dueDate: '2026-03-31',
    description: 'Monthly Health Premium - March 2026', amount: 10500000, status: 'Paid'
  },
  {
    id: '4', invoiceNo: 'INV-2026-004', date: '2026-04-01', dueDate: '2026-04-30',
    description: 'Monthly Health Premium - April 2026', amount: 10500000, status: 'Paid'
  },
  {
    id: '5', invoiceNo: 'INV-2026-005', date: '2026-05-01', dueDate: '2026-05-31',
    description: 'Monthly Health Premium - May 2026', amount: 10500000, status: 'Paid'
  },
  {
    id: '6', invoiceNo: 'INV-2026-006', date: '2026-06-01', dueDate: '2026-06-30',
    description: 'Monthly Health Premium - June 2026', amount: 10500000, status: 'Pending'
  },
];

export const mockTickets: Ticket[] = [
  {
    id: '1', ticketId: 'TKT-001', category: 'Enrolment', subject: 'New employee batch enrolment - June 2026',
    status: 'Open', sla: 'On Track', submittedDate: '2026-06-15', lastUpdated: '2026-06-15',
    description: 'Please enrol the 12 new Dangote employees listed in the attached spreadsheet.'
  },
  {
    id: '2', ticketId: 'TKT-002', category: 'Claims', subject: 'Claim denial appeal - Adaeze Okonkwo',
    status: 'In Progress', sla: 'At Risk', submittedDate: '2026-06-10', lastUpdated: '2026-06-14',
    assignee: 'Leadway Team', description: 'Appealing denial of claim for specialist consultation.'
  },
  {
    id: '3', ticketId: 'TKT-003', category: 'Benefits', subject: 'Maternity benefit query - Fatima Mohammed',
    status: 'Awaiting Leadway', sla: 'On Track', submittedDate: '2026-06-12', lastUpdated: '2026-06-13',
    description: 'Request for clarification on maternity benefit coverage limits under Pro Plan.'
  },
  {
    id: '4', ticketId: 'TKT-004', category: 'Billing', subject: 'Invoice discrepancy - INV-2026-005',
    status: 'Open', sla: 'On Track', submittedDate: '2026-06-16', lastUpdated: '2026-06-16',
    description: 'The invoice amount does not match our internal Dangote records.'
  },
  {
    id: '5', ticketId: 'TKT-005', category: 'Provider', subject: 'Provider not accepting HMO card',
    status: 'Open', sla: 'At Risk', submittedDate: '2026-06-08', lastUpdated: '2026-06-11',
    description: 'St. Nicholas Hospital refusing to accept Leadway card for Dangote employee.'
  },
  {
    id: '6', ticketId: 'TKT-006', category: 'Enrolment', subject: 'Termination - Emeka Obi',
    status: 'Open', sla: 'On Track', submittedDate: '2026-06-17', lastUpdated: '2026-06-17',
    description: 'Employee has resigned from Dangote. Please process termination of benefits.'
  },
  {
    id: '7', ticketId: 'TKT-007', category: 'General', subject: 'Request for utilization report Q1 2026',
    status: 'Closed', sla: 'On Track', submittedDate: '2026-04-02', lastUpdated: '2026-04-05',
    description: 'Please generate utilization report for Q1 2026.'
  },
  {
    id: '8', ticketId: 'TKT-008', category: 'Claims', subject: 'High cost claim authorization - Babatunde Adeyemi',
    status: 'Awaiting Client', sla: 'On Track', submittedDate: '2026-06-14', lastUpdated: '2026-06-15',
    assignee: 'Leadway Claims Team', description: 'Authorization required for surgical procedure exceeding annual limit.'
  },
];

export const mockProviders: Provider[] = [
  {
    id: '1', name: 'Lagos Island General Hospital', address: '1 Hospital Rd, Lagos Island, Lagos',
    phone: '01-2345678', specialties: ['General Practice', 'Emergency', 'Surgery', 'Obstetrics'],
    type: 'Hospital', status: 'Active', state: 'Lagos', lga: 'Lagos Island'
  },
  {
    id: '2', name: 'Reddington Hospital', address: '12 Idowu Martins, Victoria Island, Lagos',
    phone: '01-4445678', specialties: ['Cardiology', 'Oncology', 'Neurology', 'ICU'],
    type: 'Hospital', status: 'Active', state: 'Lagos', lga: 'Victoria Island'
  },
  {
    id: '3', name: 'St. Nicholas Hospital', address: '57 Campbell St, Lagos Island, Lagos',
    phone: '01-2606780', specialties: ['General Practice', 'Radiology', 'Pathology'],
    type: 'Hospital', status: 'Active', state: 'Lagos', lga: 'Lagos Island'
  },
  {
    id: '4', name: 'National Hospital Abuja', address: 'Plot 132, Phase 3, Central Business District, Abuja',
    phone: '09-5232609', specialties: ['All Specialties', 'Research', 'Trauma'],
    type: 'Hospital', status: 'Active', state: 'FCT', lga: 'Abuja Municipal'
  },
  {
    id: '5', name: 'Apex Dental Care', address: '45 Awolowo Rd, Ikoyi, Lagos',
    phone: '01-4612345', specialties: ['Dental', 'Orthodontics', 'Oral Surgery'],
    type: 'Dental', status: 'Active', state: 'Lagos', lga: 'Ikoyi'
  },
  {
    id: '6', name: 'ClearView Optometry', address: '22 Broad St, Lagos Island, Lagos',
    phone: '01-7654321', specialties: ['Optical', 'Eye Care', 'Contact Lenses'],
    type: 'Optical', status: 'Active', state: 'Lagos', lga: 'Lagos Island'
  },
];

export const mockBenefitPlans: BenefitPlan[] = [
  {
    id: '1', name: 'Plus Plan', monthlyPremium: 15000, annualPremium: 180000,
    categories: [
      {
        id: 'pp-1', name: 'Outpatient', icon: 'Stethoscope', limit: '₦150,000 per annum',
        includes: ['GP consultations only', 'Basic diagnostics', 'Essential drugs only'],
        excludes: ['Specialist consultations', 'Physiotherapy', 'Non-essential drugs'],
        waitingPeriod: 'None'
      },
      {
        id: 'pp-2', name: 'Inpatient', icon: 'Bed', limit: '₦600,000 per annum',
        includes: ['Ward admission (general ward)', 'Basic surgical procedures', 'Anaesthesia'],
        excludes: ['Private room', 'ICU', 'Complex surgeries'],
        waitingPeriod: '6 months'
      },
      {
        id: 'pp-3', name: 'Emergency', icon: 'AlertCircle', limit: '₦200,000 per event',
        includes: ['24/7 emergency care'],
        excludes: ['Elective procedures', 'Ambulance', 'Emergency abroad'],
        waitingPeriod: 'None'
      },
    ]
  },
  {
    id: '2', name: 'Pro Plan', monthlyPremium: 28000, annualPremium: 336000,
    categories: [
      {
        id: 'pr-1', name: 'Outpatient', icon: 'Stethoscope', limit: '₦300,000 per annum',
        includes: ['GP consultations', 'Specialist consultations (pre-approval)', 'Basic diagnostics', 'Prescribed drugs (formulary)'],
        excludes: ['Physiotherapy', 'Cosmetic procedures', 'Non-formulary drugs'],
        waitingPeriod: 'None'
      },
      {
        id: 'pr-2', name: 'Inpatient', icon: 'Bed', limit: '₦1,200,000 per annum',
        includes: ['Ward admission (general ward)', 'Surgical procedures', 'Anaesthesia', 'Blood transfusion'],
        excludes: ['Private room', 'ICU (except emergency)', 'Experimental treatments'],
        waitingPeriod: '3 months'
      },
      {
        id: 'pr-3', name: 'Maternity', icon: 'Baby', limit: '₦250,000 per delivery',
        includes: ['Antenatal care (6 visits)', 'Normal delivery', 'Caesarean section', 'Postnatal care'],
        excludes: ['Fertility treatments', 'Newborn care beyond 14 days'],
        waitingPeriod: '10 months'
      },
      {
        id: 'pr-4', name: 'Dental', icon: 'Smile', limit: '₦80,000 per annum',
        includes: ['Consultations', 'Extractions', 'Fillings', 'Scaling & polishing'],
        excludes: ['Root canal', 'Orthodontic braces', 'Cosmetic dentistry'],
        waitingPeriod: '3 months'
      },
      {
        id: 'pr-5', name: 'Emergency', icon: 'AlertCircle', limit: '₦500,000 per event',
        includes: ['24/7 emergency care', 'Emergency surgery'],
        excludes: ['Ambulance service', 'Emergency abroad'],
        waitingPeriod: 'None'
      },
    ]
  },
  {
    id: '3', name: 'Max Plan', monthlyPremium: 45000, annualPremium: 540000,
    categories: [
      {
        id: 'mp-1', name: 'Outpatient', icon: 'Stethoscope', limit: '₦500,000 per annum',
        includes: ['GP consultations', 'Specialist consultations', 'Diagnostic tests', 'Prescribed drugs (formulary)', 'Physiotherapy (12 sessions)'],
        excludes: ['Cosmetic procedures', 'Non-formulary drugs'],
        waitingPeriod: 'None'
      },
      {
        id: 'mp-2', name: 'Inpatient', icon: 'Bed', limit: '₦2,000,000 per annum',
        includes: ['Ward admission (private room)', 'Surgical procedures', 'Anaesthesia', 'ICU/HDU', 'Blood transfusion'],
        excludes: ['Experimental treatments', 'Self-inflicted injuries'],
        waitingPeriod: '3 months'
      },
      {
        id: 'mp-3', name: 'Maternity', icon: 'Baby', limit: '₦400,000 per delivery',
        includes: ['Antenatal care (8 visits)', 'Normal delivery', 'Caesarean section', 'Postnatal care', 'Newborn care (30 days)'],
        excludes: ['Fertility treatments', 'Surrogacy'],
        waitingPeriod: '10 months'
      },
      {
        id: 'mp-4', name: 'Dental', icon: 'Smile', limit: '₦150,000 per annum',
        includes: ['Consultations', 'Extractions', 'Fillings', 'Scaling & polishing', 'Root canal (1 per annum)'],
        excludes: ['Orthodontic braces', 'Cosmetic dentistry', 'Implants'],
        waitingPeriod: '3 months'
      },
      {
        id: 'mp-5', name: 'Optical', icon: 'Eye', limit: '₦80,000 per annum',
        includes: ['Eye examination', 'Prescription glasses (1 pair)', 'Contact lenses', 'Treatment of eye conditions'],
        excludes: ['LASIK surgery', 'Luxury frames (above ₦30,000)'],
        waitingPeriod: '3 months'
      },
      {
        id: 'mp-6', name: 'Specialist Referrals', icon: 'UserCheck', limit: 'Unlimited referrals',
        includes: ['All medical specialties', 'Overseas referral (pre-approval)', 'Second opinion'],
        excludes: ['Referrals without GP authorization'],
        waitingPeriod: 'None'
      },
      {
        id: 'mp-7', name: 'Emergency', icon: 'AlertCircle', limit: 'Unlimited',
        includes: ['24/7 emergency care', 'Ambulance service', 'Emergency surgery', 'Emergency abroad (₦2M limit)'],
        excludes: ['Non-emergency visits to A&E'],
        waitingPeriod: 'None'
      },
    ]
  },
  {
    id: '4', name: 'Promax Plan', monthlyPremium: 75000, annualPremium: 900000,
    categories: [
      {
        id: 'pmx-1', name: 'Outpatient', icon: 'Stethoscope', limit: '₦1,000,000 per annum',
        includes: ['GP consultations', 'Unlimited specialist consultations', 'Advanced diagnostics', 'All formulary drugs', 'Physiotherapy (24 sessions)', 'Mental health (12 sessions)'],
        excludes: ['Cosmetic procedures'],
        waitingPeriod: 'None'
      },
      {
        id: 'pmx-2', name: 'Inpatient', icon: 'Bed', limit: '₦5,000,000 per annum',
        includes: ['Private room admission', 'All surgical procedures', 'Anaesthesia', 'ICU/HDU', 'Blood transfusion', 'Rehabilitation (30 days)'],
        excludes: ['Experimental treatments'],
        waitingPeriod: 'None'
      },
      {
        id: 'pmx-3', name: 'Maternity', icon: 'Baby', limit: '₦700,000 per delivery',
        includes: ['Unlimited antenatal visits', 'Normal & C-section delivery', 'Postnatal care', 'Newborn care (60 days)', 'Fertility consultations'],
        excludes: ['Surrogacy', 'IVF treatment'],
        waitingPeriod: '6 months'
      },
      {
        id: 'pmx-4', name: 'Dental', icon: 'Smile', limit: '₦300,000 per annum',
        includes: ['Consultations', 'Extractions', 'Fillings', 'Root canal (2 per annum)', 'Orthodontic assessment', 'Scaling & polishing'],
        excludes: ['Cosmetic implants', 'Purely aesthetic orthodontics'],
        waitingPeriod: 'None'
      },
      {
        id: 'pmx-5', name: 'Optical', icon: 'Eye', limit: '₦150,000 per annum',
        includes: ['Eye examination', 'Frames (any price)', 'Contact lenses', 'LASIK assessment'],
        excludes: ['LASIK surgery'],
        waitingPeriod: 'None'
      },
      {
        id: 'pmx-6', name: 'Specialist Referrals', icon: 'UserCheck', limit: 'Unlimited',
        includes: ['All medical specialties', 'Overseas referral', 'Second & third opinions', 'Telemedicine'],
        excludes: [],
        waitingPeriod: 'None'
      },
      {
        id: 'pmx-7', name: 'Emergency', icon: 'AlertCircle', limit: 'Unlimited',
        includes: ['24/7 emergency care', 'Ambulance service', 'Emergency surgery', 'Emergency abroad (₦5M limit)', 'Medical evacuation'],
        excludes: [],
        waitingPeriod: 'None'
      },
    ]
  },
  {
    id: '5', name: 'Magnum Plan', monthlyPremium: 120000, annualPremium: 1440000,
    categories: [
      {
        id: 'mgm-1', name: 'Outpatient', icon: 'Stethoscope', limit: 'Unlimited',
        includes: ['GP consultations', 'Unlimited specialist consultations', 'Advanced & specialist diagnostics', 'All drugs (formulary & non-formulary)', 'Unlimited physiotherapy', 'Mental health (unlimited)', 'Executive health screening (annual)'],
        excludes: ['Purely cosmetic procedures'],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-2', name: 'Inpatient', icon: 'Bed', limit: 'Unlimited',
        includes: ['VIP room admission', 'All surgical procedures', 'Anaesthesia', 'ICU/HDU', 'Blood & plasma transfusion', 'Rehabilitation (90 days)', 'Companion accommodation'],
        excludes: [],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-3', name: 'Maternity', icon: 'Baby', limit: '₦1,500,000 per delivery',
        includes: ['Unlimited antenatal visits', 'Delivery (all methods)', 'Postnatal care', 'Newborn care (90 days)', 'IVF (1 cycle)', 'Fertility treatments'],
        excludes: ['Surrogacy'],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-4', name: 'Dental', icon: 'Smile', limit: 'Unlimited',
        includes: ['All dental treatments', 'Implants (2 per annum)', 'Orthodontic treatment', 'Cosmetic dentistry (pre-approved)'],
        excludes: [],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-5', name: 'Optical', icon: 'Eye', limit: 'Unlimited',
        includes: ['Eye examination', 'Frames (unlimited)', 'Contact lenses', 'LASIK surgery', 'Retinal screening'],
        excludes: [],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-6', name: 'Specialist Referrals', icon: 'UserCheck', limit: 'Unlimited',
        includes: ['All medical specialties', 'International referral (UK, India, UAE)', 'Unlimited opinions', 'Telemedicine 24/7', 'Medical concierge service'],
        excludes: [],
        waitingPeriod: 'None'
      },
      {
        id: 'mgm-7', name: 'Emergency', icon: 'AlertCircle', limit: 'Unlimited',
        includes: ['24/7 emergency care', 'Ambulance service', 'Emergency surgery', 'International emergency (unlimited)', 'Air ambulance', 'Medical evacuation & repatriation'],
        excludes: [],
        waitingPeriod: 'None'
      },
    ]
  },
];

export const mockUsers: User[] = [
  {
    id: '1', name: 'Chidi Nwosu', email: 'chidi.nwosu@dangote.com',
    role: 'Admin', status: 'Active', lastLogin: '2026-06-24T09:23:00'
  },
  {
    id: '2', name: 'Favour Komoni', email: 'favour.komoni@dangote.com',
    role: 'HR Manager', status: 'Active', lastLogin: '2026-06-24T08:45:00'
  },
  {
    id: '3', name: 'Kemi Oladele', email: 'kemi.oladele@dangote.com',
    role: 'Finance', status: 'Active', lastLogin: '2026-06-23T14:30:00'
  },
  {
    id: '4', name: 'Tunde Fashola', email: 'tunde.fashola@dangote.com',
    role: 'Viewer', status: 'Inactive', lastLogin: '2026-05-20T10:00:00'
  },
];

export const mockDashboardMetrics: DashboardMetrics = {
  activeLives: 1842,
  newThisMonth: 24,
  utilizationRate: 26.4,
  utilizersCount: 487,
  lossRatio: 77,
  lossRatioChange: 6,
  openIssues: 4,
  outstandingPremium: 10500000,
  premiumDueDays: 7,
};

export const mockMonthlySpend: MonthlySpend[] = [
  { month: 'Jan', amount: 6200000 },
  { month: 'Feb', amount: 7800000 },
  { month: 'Mar', amount: 6900000 },
  { month: 'Apr', amount: 8400000 },
  { month: 'May', amount: 9100000 },
  { month: 'Jun', amount: 9800000 },
];

export const mockTopConditions: TopCondition[] = [
  { condition: 'Malaria', count: 284 },
  { condition: 'Hypertension', count: 198 },
  { condition: 'URTI', count: 167 },
  { condition: 'Pregnancy Related', count: 143 },
  { condition: 'Diabetes', count: 89 },
];

export const mockTopProviders: TopProvider[] = [
  { name: 'Lagos Island General', visits: 312, spend: 4200000 },
  { name: 'Reddington Hospital', visits: 204, spend: 6800000 },
  { name: 'St. Nicholas', visits: 189, spend: 3100000 },
  { name: 'National Hospital Abuja', visits: 156, spend: 2900000 },
  { name: 'Apex Dental', visits: 89, spend: 800000 },
];

export const mockClaims: Claim[] = [
  { id:'1',  claimRef:'CLM-2026-0841', memberName:'Adaeze Okonkwo',     employeeId:'EMP001', plan:'Max Plan',    provider:'Reddington Hospital',       category:'Inpatient',  diagnosis:'Acute Appendicitis',          amount:312000,  status:'Paid',       submittedDate:'2026-03-22', settledDate:'2026-03-30' },
  { id:'2',  claimRef:'CLM-2026-0842', memberName:'Chukwuemeka Eze',     employeeId:'EMP002', plan:'Max Plan',    provider:'Lagos Island General',       category:'Outpatient', diagnosis:'Malaria Fever',               amount:28500,   status:'Paid',       submittedDate:'2026-04-05', settledDate:'2026-04-08' },
  { id:'3',  claimRef:'CLM-2026-0843', memberName:'Fatima Mohammed',     employeeId:'EMP003', plan:'Pro Plan',    provider:'National Hospital Abuja',    category:'Maternity',  diagnosis:'Normal Delivery',             amount:185000,  status:'Paid',       submittedDate:'2026-02-14', settledDate:'2026-02-22' },
  { id:'4',  claimRef:'CLM-2026-0844', memberName:'Babatunde Adeyemi',   employeeId:'EMP004', plan:'Pro Plan',    provider:'Reddington Hospital',        category:'Emergency',  diagnosis:'Road Traffic Accident',       amount:540000,  status:'Processing', submittedDate:'2026-06-10' },
  { id:'5',  claimRef:'CLM-2026-0845', memberName:'Ngozi Ikenna',        employeeId:'EMP005', plan:'Plus Plan',   provider:'Apex Dental Clinic',         category:'Dental',     diagnosis:'Root Canal Treatment',        amount:45000,   status:'Paid',       submittedDate:'2026-05-04', settledDate:'2026-05-09' },
  { id:'6',  claimRef:'CLM-2026-0846', memberName:'Segun Afolabi',       employeeId:'EMP006', plan:'Plus Plan',   provider:'St. Nicholas Hospital',      category:'Inpatient',  diagnosis:'Hypertensive Crisis',         amount:220000,  status:'Paid',       submittedDate:'2026-04-18', settledDate:'2026-04-28' },
  { id:'7',  claimRef:'CLM-2026-0847', memberName:'Amina Yusuf',         employeeId:'EMP007', plan:'Max Plan',    provider:'Clear Vision Eye Clinic',    category:'Optical',    diagnosis:'Refractive Error',            amount:22000,   status:'Queried',    submittedDate:'2026-05-22' },
  { id:'8',  claimRef:'CLM-2026-0848', memberName:'Emeka Obi',           employeeId:'EMP008', plan:'Pro Plan',    provider:'Lagos Island General',        category:'Outpatient', diagnosis:'Typhoid Fever',               amount:18500,   status:'Paid',       submittedDate:'2026-06-01', settledDate:'2026-06-04' },
  { id:'9',  claimRef:'CLM-2026-0849', memberName:'Chioma Nwosu',        employeeId:'EMP009', plan:'Promax Plan', provider:'Reddington Hospital',        category:'Outpatient', diagnosis:'Diabetes Follow-up',          amount:35000,   status:'Paid',       submittedDate:'2026-06-12', settledDate:'2026-06-14' },
  { id:'10', claimRef:'CLM-2026-0850', memberName:'Kemi Adeleke',        employeeId:'EMP010', plan:'Promax Plan', provider:'National Hospital Abuja',    category:'Inpatient',  diagnosis:'Asthma Exacerbation',         amount:165000,  status:'Processing', submittedDate:'2026-06-15' },
  { id:'11', claimRef:'CLM-2026-0851', memberName:'Tunde Bakare',        employeeId:'EMP011', plan:'Magnum Plan', provider:'Eko Hospital',               category:'Inpatient',  diagnosis:'Cardiac Catheterisation',     amount:890000,  status:'Queried',    submittedDate:'2026-06-08' },
  { id:'12', claimRef:'CLM-2026-0852', memberName:'Yetunde Adesanya',    employeeId:'EMP012', plan:'Magnum Plan', provider:'Lagos Island General',        category:'Outpatient', diagnosis:'Upper Respiratory Infection', amount:12000,   status:'Paid',       submittedDate:'2026-06-18', settledDate:'2026-06-20' },
  { id:'13', claimRef:'CLM-2026-0853', memberName:'Obiora Nnamdi',       employeeId:'EMP013', plan:'Pro Plan',    provider:'Apex Dental Clinic',         category:'Dental',     diagnosis:'Tooth Extraction',            amount:18000,   status:'Rejected',   submittedDate:'2026-05-30' },
  { id:'14', claimRef:'CLM-2026-0854', memberName:'Halima Garba',        employeeId:'EMP014', plan:'Max Plan',    provider:'Reddington Hospital',        category:'Outpatient', diagnosis:'Hypertension Management',     amount:42000,   status:'Paid',       submittedDate:'2026-06-03', settledDate:'2026-06-06' },
  { id:'15', claimRef:'CLM-2026-0855', memberName:'Chidi Okeke',         employeeId:'EMP015', plan:'Pro Plan',    provider:'St. Nicholas Hospital',      category:'Emergency',  diagnosis:'Fracture — Left Tibia',       amount:310000,  status:'Processing', submittedDate:'2026-06-20' },
];
