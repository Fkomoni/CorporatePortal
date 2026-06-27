import { Route, Routes } from "react-router-dom";

import IndexPage from "@/pages/index";
import DefaultLayout from "@/layouts/default";
import LeadwayLoginPage from "@/pages/auth/login";
import EnrollmentPage from "@/pages/enrollment";
import BulkUploadPage from "@/pages/bulk-upload";
import DashboardPage from "@/pages/dashboard";
import GroupEnrollmentPage from "@/pages/group-enrollment";
import InvoicePage from "@/pages/invoice";
import InvoiceRemindersPage from "@/pages/invoice-reminders";
import PaymentRecordingPage from "@/pages/payment-recording";
import EndorsementPage from "@/pages/endorsement";
import CertificatePage from "@/pages/certificate";
import TerminationPage from "@/pages/termination";
import ProtectedRoute from "@/components/protected";

function App() {
  return (
    <Routes>
      <Route element={<IndexPage />} path="/" />

      <Route
        element={
          <ProtectedRoute>
            <LeadwayLoginPage />
          </ProtectedRoute>
        }
        path="/login"
      />

      <Route element={<DefaultLayout />} path="/dashboard">
        <Route index element={<DashboardPage />} />
        <Route element={<EnrollmentPage />} path="enrollment" />
        <Route element={<BulkUploadPage />} path="bulk-upload" />
        <Route element={<GroupEnrollmentPage />} path="group-enrollment" />
        <Route element={<InvoicePage />} path="invoice" />
        <Route element={<InvoiceRemindersPage />} path="invoice-reminders" />
        <Route element={<PaymentRecordingPage />} path="payment-recording" />
        <Route element={<EndorsementPage />} path="endorsement" />
        <Route element={<CertificatePage />} path="certificate" />
        <Route element={<TerminationPage />} path="termination" />
      </Route>
    </Routes>
  );
}

export default App;
