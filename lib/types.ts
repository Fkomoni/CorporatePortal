export interface Member {
  id: string;
  employeeId: string;
  staffId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  plan: 'Plus Plan' | 'Pro Plan' | 'Max Plan' | 'Promax Plan' | 'Magnum Plan';
  type: 'Principal' | 'Dependant';
  // "Pending Termination" is its own state, not a kind of Terminated: the
  // member is still covered and still claiming until the effective date.
  status: 'Active' | 'Pending' | 'Pending Termination' | 'Terminated';
  location: string;
  enrollmentDate: string;
  dependants?: number;
  premium?: number;
  cifNumber?: string;
  schemeId?: string;
}

/**
 * Whether a member is on cover right now.
 *
 * A scheduled departure is not a departure: someone leaving on 28 Aug is
 * covered, claiming and premium-bearing until that date, so every headcount
 * that means "covered lives" has to include them. Kept as one predicate so the
 * roster, the summary cards and the wellness roster cannot drift apart on it.
 */
export function isCoveredStatus(status: Member['status']): boolean {
  return status === 'Active' || status === 'Pending Termination';
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue' | 'Draft';
}

export interface Ticket {
  id: string;
  ticketId: string;
  category: 'Enrolment' | 'Claims' | 'Benefits' | 'General' | 'Billing' | 'Provider';
  subject: string;
  status: 'Open' | 'In Progress' | 'Awaiting Leadway' | 'Awaiting Client' | 'Closed';
  sla: 'On Track' | 'At Risk' | 'Breached';
  submittedDate: string;
  lastUpdated: string;
  assignee?: string;
  description: string;
}

export interface Provider {
  id: string;
  name: string;
  address: string;
  phone: string;
  specialties: string[];
  type: 'Hospital' | 'Clinic' | 'Dental' | 'Optical' | 'Pharmacy' | 'Specialist';
  status: 'Active' | 'Suspended';
  state: string;
  lga: string;
}

export interface BenefitCategory {
  id: string;
  name: string;
  icon: string;
  limit: string;
  includes: string[];
  excludes: string[];
  waitingPeriod?: string;
}

export interface BenefitPlan {
  id: string;
  name: 'Plus Plan' | 'Pro Plan' | 'Max Plan' | 'Promax Plan' | 'Magnum Plan';
  monthlyPremium: number;
  annualPremium: number;
  categories: BenefitCategory[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'HR Manager' | 'Finance' | 'Viewer';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  avatar?: string;
}

export interface DashboardMetrics {
  activeLives: number;
  newThisMonth: number;
  utilizationRate: number;
  utilizersCount: number;
  lossRatio: number;
  lossRatioChange: number;
  openIssues: number;
  outstandingPremium: number;
  premiumDueDays: number;
}

export interface MonthlySpend {
  month: string;
  amount: number;
}

export interface TopCondition {
  condition: string;
  count: number;
}

export interface TopProvider {
  name: string;
  visits: number;
  spend: number;
}

export interface Claim {
  id: string;
  claimRef: string;
  memberName: string;
  employeeId: string;
  plan: 'Plus Plan' | 'Pro Plan' | 'Max Plan' | 'Promax Plan' | 'Magnum Plan';
  provider: string;
  category: 'Outpatient' | 'Inpatient' | 'Dental' | 'Optical' | 'Maternity' | 'Emergency';
  diagnosis: string;
  amount: number;
  status: 'Paid' | 'Processing' | 'Queried' | 'Rejected';
  submittedDate: string;
  settledDate?: string;
}
