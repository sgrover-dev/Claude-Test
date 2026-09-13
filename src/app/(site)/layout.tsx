import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { CompareProvider } from "@/components/search/CompareContext";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompareProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </CompareProvider>
  );
}
