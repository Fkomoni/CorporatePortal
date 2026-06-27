import { Button } from "@heroui/button";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useChunkValue } from "stunk/react";

import { authStore, logout } from "@/lib/store/auth";
import {
  DeleteIcon,
  GroupPersonIcon,
  InvoiceIcon,
  LogoutIcon,
  PaymentRecordingIcon,
  PersonIcon,
  UploadIcon,
} from "@/components/icons";
import DashboardCard from "@/components/dashboard-card";
import BrandLogo from "@/components/ui/brand-logo";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useChunkValue(authStore);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-12 flex justify-between items-center">
        <div>
          <BrandLogo />
          <p className="text-gray-500 text-sm mt-2">
            Welcome back to your dashboard,{" "}
            <span className="text-gray-800">{user?.UserName}</span>
          </p>
        </div>

        <div className="flex">
          <Button
            isIconOnly
            className="md:hidden bg-white border-2 border-gray-200 text-gray-700 hover:border-red-500 hover:text-red-500 font-medium transition-colors"
            onPress={handleLogout}
          >
            <LogoutIcon />
          </Button>

          <Button
            className="hidden md:flex bg-white border-2 border-gray-200 text-gray-700 hover:border-red-500 hover:text-red-500 font-medium transition-colors"
            startContent={<LogoutIcon />}
            onPress={handleLogout}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Dashboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashboardCard
          description="Enroll individual principals and dependants"
          icon={<PersonIcon />}
          title="Enrollment"
          onClick={() => handleNavigation("/dashboard/enrollment")}
        />

        <DashboardCard
          description="Upload multiple enrollees via Excel file"
          icon={<UploadIcon />}
          title="Bulk Upload"
          onClick={() => handleNavigation("/dashboard/bulk-upload")}
        />

        <DashboardCard
          description="Manage group enrollments and updates"
          icon={<GroupPersonIcon />}
          title="Group Enrollment"
          onClick={() => handleNavigation("/dashboard/group-enrollment")}
        />

        <DashboardCard
          description="View and manage invoices"
          icon={<InvoiceIcon />}
          title="Invoice"
          onClick={() => handleNavigation("/dashboard/invoice")}
        />

        <DashboardCard
          description="Generate and download endorsement invoices by date range"
          icon={<InvoiceIcon />}
          title="Endorsement"
          onClick={() => handleNavigation("/dashboard/endorsement")}
        />

        <DashboardCard
          description="Generate Certificate of Health Insurance for a group"
          icon={<InvoiceIcon />}
          title="Certificate of Insurance"
          onClick={() => handleNavigation("/dashboard/certificate")}
        />

        <DashboardCard
          description="View and send invoice payment reminders"
          icon={<InvoiceIcon />}
          title="Invoice Reminders"
          onClick={() => handleNavigation("/dashboard/invoice-reminders")}
        />

        <DashboardCard
          description="View and submit payment records"
          icon={<PaymentRecordingIcon />}
          title="Payment Recording"
          onClick={() => handleNavigation("/dashboard/payment-recording")}
        />

        <DashboardCard
          description="Terminate enrollees manually or via bulk Excel upload"
          icon={<DeleteIcon className="h-7 w-7" />}
          title="Termination"
          onClick={() => handleNavigation("/dashboard/termination")}
        />
      </div>
    </div>
  );
}
