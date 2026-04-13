import { LanguageProvider } from "@/i18n/LanguageContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const Index = () => (
  <LanguageProvider>
    <DashboardLayout />
  </LanguageProvider>
);

export default Index;
