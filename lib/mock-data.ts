import { Member, Invoice, Ticket, Provider, BenefitPlan, User, DashboardMetrics, MonthlySpend, TopCondition, TopProvider } from './types';

export const mockMembers: Member[] = [
  { id: '1', employeeId: 'EMP001', firstName: 'Adaeze', lastName: 'Okonkwo', email: 'adaeze.okonkwo@dangote.com', phone: '08031234567', gender: 'Female', dateOfBirth: '1985-03-15', plan: 'Gold Plus', type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2023-01-01', dependants: 3 },
  { id: '2', employeeId: 'EMP002', firstName: 'Chukwuemeka', lastName: 'Eze', email: 'chukwuemeka.eze@dangote.com', phone: '08055678901', gender: 'Male', dateOfBirth: '1978-07-22', plan: 'Gold Plus', type: 'Principal', status: 'Active', location: 'Abuja', enrollmentDate: '2023-01-01', dependants: 2 },
  { id: '3', employeeId: 'EMP003', firstName: 'Fatima', lastName: 'Mohammed', email: 'fatima.mohammed@dangote.com', phone: '08067891234', gender: 'Female', dateOfBirth: '1990-11-08', plan: 'Silver', type: 'Principal', status: 'Active', location: 'Kano', enrollmentDate: '2023-01-01', dependants: 1 },
  { id: '4', employeeId: 'EMP004', firstName: 'Babatunde', lastName: 'Adeyemi', email: 'babatunde.adeyemi@dangote.com', phone: '08012345678', gender: 'Male', dateOfBirth: '1982-05-30', plan: 'Silver', type: 'Principal', status: 'Active', location: 'Lagos', enrollmentDate: '2023-02-15', dependants: 4 },
  { id: '5', employeeId: 'EMP005', firstName: 'Ngozi', lastName: 'Ikenna', email: 'ngozi.ikenna@dangote.com', phone: '08098765432', gender: 'Female', dateOfBirth: '1995-09-12', plan: 'Bronze', type: 'Principal', status: 'Pending', location: 'Port Harcourt', enrollmentDate: '2024-06-01', dependants: 0 },
  { id: '6', employeeId: 'EMP006', firstName: 'Segun', lastName: 'Afolabi', email: 'segun.afolabi@dangote.com', phone: '08023456789', gender: 'Male', dateOfBirth: '1988-12-03', plan: 'Bronze', type: 'Principal', status: 'Active', location: 'Ibadan', enrollmentDate: '2023-03-01', dependants: 2 },
  { id: '7', employeeId: 'EMP007', firstName: 'Amina', lastName: 'Yusuf', email: 'amina.yusuf@dangote.com', phone: '08045678901', gender: 'Female', dateOfBirth: '1993-04-18', plan: 'Gold Plus', type: 'Dependant', status: 'Active', location: 'Abuja', enrollmentDate: '2023-01-01' },
  { id: '8', employeeId: 'EMP008', firstName: 'Emeka', lastName: 'Obi', email: 'emeka.obi@dangote.com', phone: '08076543210', gender: 'Male', dateOfBirth: '1975-08-25', plan: 'Silver', type: 'Principal', status: 'Terminated', location: 'Lagos', enrollmentDate: '2022-06-01', dependants: 1 },
];

export const mockInvoices: Invoice[] = [
  { id: '1', invoiceNo: 'INV-2026-001', date: '2026-01-01', dueDate: '2026-01-31', description: 'Monthly Health Premium - January 2026', amount: 10500000, status: 'Paid' },
  { id: '2', invoiceNo: 'INV-2026-002', date: '2026-02-01', dueDate: '2026-02-28', description: 'Monthly Health Premium - February 2026', amount: 10500000, status: 'Paid' },
  { id: '3', invoiceNo: 'INV-2026-003', date: '2026-03-01', dueDate: '2026-03-31', description: 'Monthly Health Premium - March 2026', amount: 10500000, status: 'Paid' },
  { id: '4', invoiceNo: 'INV-2026-004', date: '2026-04-01', dueDate: '2026-04-30', description: 'Monthly Health Premium - April 2026', amount: 10500000, status: 'Paid' },
  { id: '5', invoiceNo: 'INV-2026-005', date: '2026-05-01', dueDate: '2026-05-31', description: 'Monthly Health Premium - May 2026', amount: 10500000, status: 'Paid' },
  { id: '6', invoiceNo: 'INV-2026-006', date: '2026-06-01', dueDate: '2026-06-30', description: 'Monthly Health Premium - June 2026', amount: 10500000, status: 'Pending' },
];

export const mockTickets: Ticket[] = [
  { id: '1', ticketId: 'TK-0041', category: 'Enrolment', subject: 'New staff enrolment - Batch 12', status: 'Open', sla: 'On Track', submittedDate: '2026-06-20', lastUpdated: '2026-06-20', description: 'Please enrol the 12 new employees listed in the attached spreadsheet.' },
  { id: '2', ticketId: 'TK-0039', category: 'Claims', subject: 'Claims query - Mrs Adeyemi', status: 'In Progress', sla: 'At Risk', submittedDate: '2026-06-19', lastUpdated: '2026-06-21', assignee: 'Leadway Team', description: 'Appealing denial of claim for specialist consultation.' },
  { id: '3', ticketId: 'TK-0038', category: 'Benefits', subject: 'E-card reprint - Oluwaseun', status: 'Awaiting Leadway', sla: 'On Track', submittedDate: '2026-06-17', lastUpdated: '2026-06-18', description: 'Request for replacement e-card.' },
  { id: '4', ticketId: 'TK-0037', category: 'General', subject: 'Maternity benefit query', status: 'Open', sla: 'On Track', submittedDate: '2026-06-15', lastUpdated: '2026-06-15', description: 'Request for clarification on maternity benefit coverage limits.' },
  { id: '5', ticketId: 'TK-0036', category: 'Billing', subject: 'Invoice discrepancy - INV-2026-005', status: 'Open', sla: 'At Risk', submittedDate: '2026-06-10', lastUpdated: '2026-06-14', description: 'Invoice amount does not match internal records.' },
  { id: '6', ticketId: 'TK-0035', category: 'Provider', subject: 'Provider not accepting HMO card', status: 'Awaiting Client', sla: 'On Track', submittedDate: '2026-06-08', lastUpdated: '2026-06-12', description: 'St Nicholas Hospital refusing Leadway card.' },
  { id: '7', ticketId: 'TK-0034', category: 'General', subject: 'Request for utilization report Q1 2026', status: 'Closed', sla: 'On Track', submittedDate: '2026-04-02', lastUpdated: '2026-04-05', description: 'Please generate utilization report for Q1 2026.' },
  { id: '8', ticketId: 'TK-0033', category: 'Claims', subject: 'High cost claim authorization - Babatunde Adeyemi', status: 'In Progress', sla: 'On Track', submittedDate: '2026-06-14', lastUpdated: '2026-06-15', assignee: 'Leadway Claims Team', description: 'Authorization required for surgical procedure.' },
];

export const mockUsers: User[] = [
  { id: '1', name: 'Amaka Fashola', email: 'amaka.fashola@dangote.com', role: 'Admin', status: 'Active', lastLogin: '2026-06-23T09:14:00' },
  { id: '2', name: 'Bola Adesanya', email: 'bola.adesanya@dangote.com', role: 'HR Manager', status: 'Active', lastLogin: '2026-06-23T08:45:00' },
  { id: '3', name: 'Kemi Oladele', email: 'kemi.oladele@dangote.com', role: 'Finance', status: 'Active', lastLogin: '2026-06-22T14:30:00' },
  { id: '4', name: 'Tunde Fashola', email: 'tunde.fashola@dangote.com', role: 'Viewer', status: 'Inactive', lastLogin: '2026-05-20T10:00:00' },
];

export const mockProviders: Provider[] = [
  { id: '1', name: 'Lagos Island General Hospital', address: '1 Hospital Rd, Lagos Island', phone: '01-2345678', specialties: ['General Practice', 'Emergency', 'Surgery'], type: 'Hospital', status: 'Active', state: 'Lagos', lga: 'Lagos Island' },
  { id: '2', name: 'Reddington Hospital', address: '12 Idowu Martins, Victoria Island', phone: '01-4445678', specialties: ['Cardiology', 'Oncology', 'ICU'], type: 'Hospital', status: 'Active', state: 'Lagos', lga: 'Victoria Island' },
];

export const mockDashboardMetrics: DashboardMetrics = {
  activeLives: 1842, newThisMonth: 24, utilizationRate: 26.4, utilizersCount: 487,
  lossRatio: 77, lossRatioChange: 6, openIssues: 4, outstandingPremium: 10500000, premiumDueDays: 7,
};

export const mockMonthlySpend: MonthlySpend[] = [
  { month: 'Jan', amount: 6200000 }, { month: 'Feb', amount: 7800000 }, { month: 'Mar', amount: 6900000 },
  { month: 'Apr', amount: 8400000 }, { month: 'May', amount: 9100000 }, { month: 'Jun', amount: 9800000 },
];

export const mockTopConditions: TopCondition[] = [
  { condition: 'Malaria', count: 284 }, { condition: 'Hypertension', count: 198 },
  { condition: 'URTI', count: 167 }, { condition: 'Pregnancy Related', count: 143 }, { condition: 'Diabetes', count: 89 },
];

export const mockTopProviders: TopProvider[] = [
  { name: 'Lagos Island General', visits: 312, spend: 4200000 },
  { name: 'Reddington Hospital', visits: 204, spend: 6800000 },
  { name: 'St. Nicholas', visits: 189, spend: 3100000 },
];

export const mockBenefitPlans: BenefitPlan[] = [];
