import { AppShell } from "@/components/AppShell";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Workspace",
};

export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
